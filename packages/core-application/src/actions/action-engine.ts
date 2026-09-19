import type { ActionResultPayload, UIActionEnvelope } from '@ai-team/ui-contract';
import { defaultValidator } from '@ai-team/ui-contract';
import {
  createInitialProjectState, reduceAllProjectEvents, reduceProjectState,
  type ActionDedupeStorePort, type ActionResultStorePort, type Clock, type DomainEvent,
  type DurableActionCommitPort, type EventStorePort, type IdGenerator, type ProjectState,
  type StoredActionResult, type StoredEvent,
} from '@ai-team/core-domain';
import type { ActionDispatcherPort } from '../index.js';
import type { ActionPlan, ActionPlannerPort } from './action-planner.js';
import { actionFingerprint } from './action-fingerprint.js';

function toPayload(result: StoredActionResult): ActionResultPayload {
  return {
    schemaVersion: '1.0.0', actionId: result.actionId, operationId: result.operationId,
    status: result.status, currentStateRevision: result.currentStateRevision,
    ...(result.message === undefined ? {} : { message: result.message }),
    ...(result.rejectionReason === undefined ? {} : { rejectionReason: result.rejectionReason }),
    ...(result.errors === undefined ? {} : { errors: [...result.errors] }),
    ...(result.payload === undefined ? {} : { payload: result.payload }), emittedAt: result.emittedAt,
  };
}

export class ActionEngine implements ActionDispatcherPort {
  private readonly inFlight = new Map<string, { readonly fingerprint: string; readonly promise: Promise<ActionResultPayload> }>();
  public constructor(
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
    private readonly eventStore: EventStorePort,
    private readonly dedupeStore: ActionDedupeStorePort,
    private readonly resultStore: ActionResultStorePort,
    private readonly commitStore: DurableActionCommitPort,
    private readonly planner: ActionPlannerPort,
  ) {}

  public async dispatch(action: UIActionEnvelope): Promise<ActionResultPayload> {
    const operationId = typeof (action as unknown as Record<string, unknown>).operationId === 'string'
      ? (action as unknown as Record<string, unknown>).operationId as string : undefined;
    if (!operationId) return this.dispatchInternal(action);
    const fingerprint = actionFingerprint(action);
    const existing = this.inFlight.get(operationId);
    if (existing) {
      if (existing.fingerprint === fingerprint) return existing.promise;
      return this.transientConflict(action, 'OperationId was reused for a different request.', 'OPERATION_ID_REUSED');
    }
    const pending = Promise.resolve().then(() => this.dispatchInternal(action));
    this.inFlight.set(operationId, { fingerprint, promise: pending });
    try { return await pending; } finally { this.inFlight.delete(operationId); }
  }

  private async dispatchInternal(action: UIActionEnvelope): Promise<ActionResultPayload> {
    const candidate = action as unknown as Record<string, unknown>;
    const operationId = typeof candidate.operationId === 'string' ? candidate.operationId : undefined;
    const fingerprint = operationId ? actionFingerprint(action) : undefined;
    if (operationId) {
      const duplicate = await this.dedupeStore.find(operationId);
      if (duplicate) {
        return this.resolveExisting(action, fingerprint ?? '', duplicate, 'LEGACY_DEDUPE_IDENTITY_UNVERIFIED');
      }
    }
    const validation = defaultValidator.validateUIActionEnvelope(action);
    if (!operationId || typeof fingerprint !== 'string') {
      return this.invalidResult(action, validation.errors ?? ['operationId is required.']);
    }
    if (!validation.success || !validation.data) {
      const candidateProjectId = typeof candidate.projectId === 'string' ? candidate.projectId : '';
      if (!candidateProjectId) return this.invalidResult(action, validation.errors ?? ['Invalid action.']);
      const durableAction = {
        ...action,
        actionId: typeof candidate.actionId === 'string' ? candidate.actionId : 'invalid-action',
        operationId,
        intent: typeof candidate.intent === 'string' ? candidate.intent : 'INVALID',
        projectId: candidateProjectId,
        expectedStateRevision: typeof candidate.expectedStateRevision === 'number' ? candidate.expectedStateRevision : 0,
        parameters: typeof candidate.parameters === 'object' && candidate.parameters !== null ? candidate.parameters : {},
      } as UIActionEnvelope;
      return this.commitResult(durableAction, fingerprint, 0, {
        kind: 'REJECT', message: 'Action envelope validation failed.', rejectionReason: 'VALIDATION_ERROR',
        errors: validation.errors,
      }, 'REJECTED');
    }
    const validAction = validation.data;
    const state = await this.rehydrate(validAction.projectId);
    if (validAction.expectedStateRevision !== state.stateRevision) {
      return this.commitResult(validAction, fingerprint, state.stateRevision, {
        kind: 'REJECT', message: 'Expected state revision does not match current state.', rejectionReason: 'CONFLICT',
      }, 'CONFLICT');
    }
    const plan = this.planner.plan(validAction, state);
    return this.executePlan(validAction, fingerprint, state, plan);
  }

  private async rehydrate(projectId: string): Promise<ProjectState> {
    const events = await this.eventStore.getEventsByProject(projectId);
    const replay = reduceAllProjectEvents(createInitialProjectState(projectId), events.map((event) => event as DomainEvent));
    if (!replay.ok) throw new Error(`Cannot replay project event ledger: ${replay.error.message}`);
    return replay.state;
  }

  private async executePlan(action: UIActionEnvelope, fingerprint: string, state: ProjectState, plan: ActionPlan): Promise<ActionResultPayload> {
    if (plan.kind !== 'ACCEPT') return this.commitResult(action, fingerprint, state.stateRevision, plan, plan.kind === 'REJECT' ? 'REJECTED' : plan.kind);
    const event: StoredEvent = {
      eventId: this.idGenerator.next(), eventType: plan.eventType, emittedAt: this.clock.now(), projectId: action.projectId,
      ...(plan.sessionId ?? action.sessionId ? { sessionId: plan.sessionId ?? action.sessionId ?? undefined } : {}),
      ...(plan.goalId ?? action.goalId ? { goalId: plan.goalId ?? action.goalId ?? undefined } : {}),
      stateRevision: state.stateRevision + 1, sequence: state.sequence + 1, payload: plan.payload,
    };
    const reduced = reduceProjectState(state, event as DomainEvent);
    if (!reduced.ok) return this.commitResult(action, fingerprint, state.stateRevision, {
      kind: 'REJECT', message: reduced.error.message, rejectionReason: reduced.error.code, errors: [reduced.error.message],
    }, 'REJECTED');
    const result = this.makeResult(action, 'ACCEPTED', event.stateRevision, { payload: { event } });
    try {
      await this.commitStore.commitAction({
        dedupeRecord: this.dedupe(action, fingerprint, result), actionResult: result, event,
        outboxMessages: [{ messageId: this.idGenerator.next(), topic: 'domain.event', payload: event, createdAt: event.emittedAt }],
      });
      return toPayload(result);
    } catch (error) {
      return this.resolveCommitRace(action, fingerprint, error);
    }
  }

  private async resolveCommitRace(action: UIActionEnvelope, fingerprint: string, error: unknown): Promise<ActionResultPayload> {
    const existing = await this.dedupeStore.find(action.operationId);
    if (existing) return this.resolveExisting(action, fingerprint, existing, 'LEGACY_DEDUPE_IDENTITY_UNVERIFIED');
    const state = await this.rehydrate(action.projectId);
    if (state.stateRevision === action.expectedStateRevision) throw error;
    return this.commitResult(action, fingerprint, state.stateRevision, {
      kind: 'REJECT', message: 'Expected state revision does not match current state.', rejectionReason: 'CONFLICT',
    }, 'CONFLICT');
  }

  private async transientConflict(action: UIActionEnvelope, message: string, rejectionReason = 'CONFLICT'): Promise<ActionResultPayload> {
    const state = await this.rehydrate(action.projectId);
    const result = this.makeResult(action, 'CONFLICT', state.stateRevision, { message, rejectionReason });
    return toPayload(result);
  }

  private async resolveExisting(action: UIActionEnvelope, fingerprint: string, existing: NonNullable<Awaited<ReturnType<ActionDedupeStorePort['find']>>>, legacyReason: string): Promise<ActionResultPayload> {
    if (existing.projectId !== action.projectId || existing.requestFingerprint === undefined) {
      return this.transientConflict(action, existing.projectId === action.projectId
        ? 'The original operation identity cannot be verified.'
        : 'OperationId belongs to a different project.', legacyReason);
    }
    if (existing.requestFingerprint !== fingerprint) {
      return this.transientConflict(action, 'OperationId was reused for a different request.', 'OPERATION_ID_REUSED');
    }
    if (!existing.resultRef) throw new Error(`Dedupe record has no result for operationId: ${action.operationId}.`);
    const stored = await this.resultStore.getByResultId(existing.resultRef);
    if (!stored) throw new Error(`Dedupe result is missing for operationId: ${action.operationId}.`);
    return toPayload(stored);
  }

  private async commitResult(action: UIActionEnvelope, fingerprint: string, revision: number, plan: Exclude<ActionPlan, { kind: 'ACCEPT' }>, status: StoredActionResult['status'], operationId = action.operationId): Promise<ActionResultPayload> {
    const result = this.makeResult({ ...action, operationId }, status, revision, {
      message: plan.message, rejectionReason: 'rejectionReason' in plan ? plan.rejectionReason : undefined,
      errors: 'errors' in plan ? plan.errors : undefined,
    });
    try {
      await this.commitStore.commitAction({ dedupeRecord: this.dedupe({ ...action, operationId }, fingerprint, result), actionResult: result, outboxMessages: [] });
    } catch (error) {
      const existing = await this.dedupeStore.find(operationId);
      if (existing) return this.resolveExisting(action, fingerprint, existing, 'LEGACY_DEDUPE_IDENTITY_UNVERIFIED');
      throw error;
    }
    return toPayload(result);
  }

  private invalidResult(action: UIActionEnvelope, errors: readonly string[]): ActionResultPayload {
    return { schemaVersion: '1.0.0', actionId: typeof action?.actionId === 'string' ? action.actionId : '', operationId: typeof action?.operationId === 'string' ? action.operationId : '', status: 'REJECTED', currentStateRevision: 0, errors: [...errors] };
  }

  private makeResult(action: UIActionEnvelope, status: StoredActionResult['status'], revision: number, values: Partial<StoredActionResult>): StoredActionResult {
    return { resultId: this.idGenerator.next(), operationId: action.operationId, actionId: action.actionId, status, currentStateRevision: revision, emittedAt: this.clock.now(), ...values };
  }

  private dedupe(action: UIActionEnvelope, fingerprint: string, result: StoredActionResult) {
    return { operationId: action.operationId, actionId: action.actionId, intent: action.intent, status: result.status === 'ACCEPTED' ? 'ACCEPTED' as const : 'REJECTED' as const, firstSeenAt: result.emittedAt, lastSeenAt: result.emittedAt, resultRef: result.resultId, projectId: action.projectId, requestFingerprint: fingerprint };
  }
}