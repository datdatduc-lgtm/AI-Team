import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, afterEach } from 'vitest';
import { ActionEngine, type ActionPlan, type ActionPlannerPort } from '@ai-team/core-application';
import type { Clock, IdGenerator, ProjectState } from '@ai-team/core-domain';
import { SqliteDurableStore } from '@ai-team/core-infrastructure';
import type { UIActionEnvelope } from '@ai-team/ui-contract';

const paths: string[] = [];
const stores: SqliteDurableStore[] = [];
let idSequence = 0;
const clock: Clock = { now: () => '2026-09-19T00:00:00.000Z' };
function ids(): IdGenerator { return { next: () => `id-${++idSequence}` }; }
async function databasePath(): Promise<string> { const dir = await mkdtemp(join(tmpdir(), 'ai-team-p0-4-')); paths.push(dir); return join(dir, 'actions.sqlite'); }
afterEach(async () => { for (const store of stores.splice(0)) store.close(); for (const path of paths.splice(0)) await rm(path, { recursive: true, force: true }); });

const action = (operationId = 'op-1', expectedStateRevision = 0, parameters: Record<string, unknown> = {}): UIActionEnvelope => ({
  schemaVersion: '1.0.0', actionId: 'action-1', operationId, intent: 'INITIALIZE_AI_TEAM', projectId: 'project-A',
  sessionId: 'session-A', goalId: null, expectedStateRevision, target: null, parameters,
});

class FakePlanner implements ActionPlannerPort {
  public calls = 0;
  public constructor(private readonly planResult: ActionPlan) {}
  public plan(_action: UIActionEnvelope, _state: ProjectState): ActionPlan { this.calls += 1; return this.planResult; }
}

function acceptedPlanner(): FakePlanner {
  return new FakePlanner({ kind: 'ACCEPT', eventType: 'SESSION_STATE_CHANGED', payload: { state: 'STARTING' } });
}

function engine(store: SqliteDurableStore, planner: FakePlanner): ActionEngine {
  stores.push(store);
  return new ActionEngine(clock, ids(), store, store, store, store, planner);
}

describe('P0.4 durable idempotent action engine', () => {
  it('commits accepted action once and returns the stored result on retry', async () => {
    const store = new SqliteDurableStore(await databasePath(), clock); const planner = acceptedPlanner(); const service = engine(store, planner);
    const first = await service.dispatch(action()); const second = await service.dispatch(action());
    expect(first).toEqual(second); expect(first.status).toBe('ACCEPTED'); expect(planner.calls).toBe(1);
    expect((await store.getEventsByProject('project-A')).length).toBe(1); expect((await store.fetchPending(10)).length).toBe(1);
  });

  it('returns original result after state advances and rejects same id with a different fingerprint', async () => {
    const store = new SqliteDurableStore(await databasePath(), clock); const planner = acceptedPlanner(); const service = engine(store, planner);
    const first = await service.dispatch(action());
    const nextPlanner = new FakePlanner({ kind: 'ACCEPT', eventType: 'SESSION_STATE_CHANGED', payload: { state: 'CHECKING_READINESS' } });
    await new ActionEngine(clock, ids(), store, store, store, store, nextPlanner).dispatch(action('op-2', 1));
    expect(await service.dispatch(action())).toEqual(first); expect(planner.calls).toBe(1);
    const changed = await service.dispatch(action('op-1', 0, { changed: true })); expect(changed.status).toBe('CONFLICT');
    expect((await store.getEventsByProject('project-A')).length).toBe(2);
  });

  it('persists stale revision conflict without event or outbox', async () => {
    const store = new SqliteDurableStore(await databasePath(), clock); const planner = acceptedPlanner(); const service = engine(store, planner);
    await service.dispatch(action('op-1')); const conflict = await service.dispatch(action('op-2', 0));
    expect(conflict.status).toBe('CONFLICT'); expect(planner.calls).toBe(1); expect((await store.getEventsByProject('project-A')).length).toBe(1);
    expect(await service.dispatch(action('op-2', 0))).toEqual(conflict);
  });

  it('uses reducer authority and durably rejects invalid planned transitions', async () => {
    const store = new SqliteDurableStore(await databasePath(), clock); const planner = new FakePlanner({ kind: 'ACCEPT', eventType: 'SESSION_STATE_CHANGED', payload: { state: 'READY' } });
    const result = await engine(store, planner).dispatch(action()); expect(result.status).toBe('REJECTED'); expect((await store.getEventsByProject('project-A')).length).toBe(0); expect((await store.fetchPending(10)).length).toBe(0);
  });

  it('handles concurrent same-operation dispatch with one semantic effect', async () => {
    const store = new SqliteDurableStore(await databasePath(), clock); const planner = acceptedPlanner(); const service = engine(store, planner);
    const results = await Promise.all([service.dispatch(action()), service.dispatch(action())]);
    expect(results[0]).toEqual(results[1]); expect((await store.getEventsByProject('project-A')).length).toBe(1); expect(planner.calls).toBe(1);
  });
});