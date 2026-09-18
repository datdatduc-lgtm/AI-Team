import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultValidator } from '../src/validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, '../fixtures');

function loadFixture(relativePath: string) {
  const fullPath = path.join(fixturesDir, relativePath);
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

describe('UI Contract v1.0.0 Invalid Fixtures (Must FAIL CLOSED)', () => {
  it('fails on wrong schemaVersion (must be exact 1.0.0)', () => {
    const fixture = loadFixture('invalid/wrong-schema-version.json');
    const result = defaultValidator.validateUIActionEnvelope(fixture);
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.includes('const') || e.includes('1.0.0'))).toBe(true);
  });

  it('fails when operationId is missing', () => {
    const fixture = loadFixture('invalid/missing-operation-id.json');
    const result = defaultValidator.validateUIActionEnvelope(fixture);
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.includes('operationId'))).toBe(true);
  });

  it('fails when ownership enum is invalid (e.g. SHARED)', () => {
    const fixture = loadFixture('invalid/invalid-enum-ownership.json');
    const result = defaultValidator.validateWorkerStatePayload(fixture);
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.includes('ownership'))).toBe(true);
  });

  it('fails when AgentState contains workState (conflation prevention)', () => {
    const fixture = loadFixture('invalid/agent-with-workstate-conflation.json');
    const result = defaultValidator.validateAgentStatePayload(fixture);
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.includes('additional'))).toBe(true);
  });

  it('fails when WorkerState contains healthStatus (conflation prevention)', () => {
    const fixture = loadFixture('invalid/worker-with-healthstatus-conflation.json');
    const result = defaultValidator.validateWorkerStatePayload(fixture);
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.includes('additional'))).toBe(true);
  });

  it('fails when action intent is not one of 12 baseline intents', () => {
    const fixture = loadFixture('invalid/invalid-action-intent.json');
    const result = defaultValidator.validateUIActionEnvelope(fixture);
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.includes('intent') || e.includes('enum'))).toBe(true);
  });

  it('fails when stateRevision is negative', () => {
    const fixture = loadFixture('invalid/negative-state-revision.json');
    const result = defaultValidator.validateSessionStatePayload(fixture);
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.includes('stateRevision') || e.includes('minimum'))).toBe(true);
  });

  it('fails when AgentState uses non-baseline agentType (e.g. ENGINEER)', () => {
    const payload = {
      schemaVersion: '1.0.0',
      agentId: 'agent-codex-01',
      displayName: 'Codex Engineer',
      agentType: 'ENGINEER',
      healthStatus: 'HEALTHY',
      statusSummary: 'Ready for instruction',
      selectedForSession: true,
      assignedToGoal: true,
      sessionRole: 'Code Implementation',
      canContinueWithoutAgent: false,
      userActionRequired: false,
      recommendedActions: [],
      stateRevision: 1,
      updatedAt: '2026-09-18T00:00:04.000Z',
    };
    const result = defaultValidator.validateAgentStatePayload(payload);
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.includes('agentType') || e.includes('enum'))).toBe(true);
  });

  it('fails when CapabilityRequirement uses non-baseline category (e.g. HOST)', () => {
    const payload = {
      schemaVersion: '1.0.0',
      requirementId: 'req-001',
      capabilityName: 'Host Folder Access',
      category: 'HOST',
      requiredForGoal: true,
      status: 'AVAILABLE',
      alternatives: [],
      recommendedActions: [],
    };
    const result = defaultValidator.validateCapabilityRequirementPayload(payload);
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.includes('category') || e.includes('enum'))).toBe(true);
  });

  it('fails when CapabilityRequirement misses requiredForGoal', () => {
    const payload = {
      schemaVersion: '1.0.0',
      requirementId: 'req-001',
      capabilityName: 'Host Folder Access',
      category: 'SKILL',
      status: 'AVAILABLE',
      alternatives: [],
      recommendedActions: [],
    };
    const result = defaultValidator.validateCapabilityRequirementPayload(payload);
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.includes('requiredForGoal'))).toBe(true);
  });

  it('fails when RouteState misses statusMessage', () => {
    const payload = {
      schemaVersion: '1.0.0',
      routeId: 'route-01',
      semanticState: 'READY',
      targetAgentId: 'agent-01',
      capturedTargetName: 'Editor',
    };
    const result = defaultValidator.validateRouteStatePayload(payload);
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.includes('statusMessage'))).toBe(true);
  });

  it('fails when SystemRecovery uses field status instead of recoveryStatus', () => {
    const payload = {
      schemaVersion: '1.0.0',
      target: {
        type: 'WORKER',
        id: 'worker-01',
      },
      whatHappened: 'Crash',
      whatAiTeamIsDoing: 'Recovering',
      whatUserShouldDo: 'Wait',
      status: 'RECOVERING',
      recommendedActions: [],
    };
    const result = defaultValidator.validateSystemRecoveryPayload(payload);
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.includes('recoveryStatus') || e.includes('additional'))).toBe(true);
  });

  it('fails when RecommendedAction contains legacy confidenceScore or title', () => {
    const payload = {
      schemaVersion: '1.0.0',
      actionCode: 'ENABLE_CAPABILITY',
      targetId: 'cap-01',
      labelKey: 'actions.enable',
      requiresApproval: true,
      title: 'Legacy Title',
      confidenceScore: 0.9,
    };
    const result = defaultValidator.validateRecommendedActionPayload(payload);
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.includes('additional'))).toBe(true);
  });

  it('fails when CoreEventEnvelope uses non-baseline eventType (e.g. RANDOM_EVENT)', () => {
    const payload = {
      schemaVersion: '1.0.0',
      eventId: 'evt-999',
      eventType: 'RANDOM_EVENT',
      emittedAt: '2026-09-18T00:00:00.000Z',
      projectId: 'proj-01',
      stateRevision: 1,
      sequence: 1,
      payload: {},
    };
    const result = defaultValidator.validateCoreEventEnvelope(payload);
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.includes('eventType') || e.includes('enum'))).toBe(true);
  });

  it('fails when WorkerState uses non-baseline workState (e.g. WORKING)', () => {
    const payload = {
      schemaVersion: '1.0.0',
      workerId: 'worker-proc-01',
      displayName: 'Worker 01',
      ownedByAgentId: 'agent-codex-01',
      workState: 'WORKING',
      supportsPauseSafepoint: true,
      ownership: 'OWNED',
      stateRevision: 4,
      updatedAt: '2026-09-18T00:00:05.000Z',
    };
    const result = defaultValidator.validateWorkerStatePayload(payload);
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.includes('workState') || e.includes('enum'))).toBe(true);
  });

  it('fails when CapabilityRequirement uses non-baseline status', () => {
    const payload = {
      schemaVersion: '1.0.0',
      requirementId: 'req-001',
      capabilityName: 'Host Folder Access',
      category: 'SKILL',
      requiredForGoal: true,
      status: 'RESOLVED',
      alternatives: [],
      recommendedActions: [],
    };
    const result = defaultValidator.validateCapabilityRequirementPayload(payload);
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.includes('status') || e.includes('enum'))).toBe(true);
  });

  it('fails when RouteState uses legacy isFocused boolean instead of semanticState', () => {
    const payload = {
      schemaVersion: '1.0.0',
      routeId: 'route-01',
      statusMessage: 'Ready',
      isFocused: true,
      semanticState: 'READY',
      targetAgentId: 'agent-01',
      capturedTargetName: 'Editor',
    };
    const result = defaultValidator.validateRouteStatePayload(payload);
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.includes('additional'))).toBe(true);
  });

  describe('12 Baseline Action Intents Coverage', () => {
    const baselineIntents = [
      'INITIALIZE_AI_TEAM',
      'SET_SESSION_TEAM',
      'CHECK_SESSION_READINESS',
      'CAPTURE_FOCUSED_ROUTE',
      'SUBMIT_GOAL',
      'ENABLE_CAPABILITY',
      'RESOLVE_CAPABILITY_REQUIREMENT',
      'START_GOAL_EXECUTION',
      'STOP_CURRENT_GOAL',
      'PAUSE_WORKER_SAFEPOINT',
      'EXECUTE_RECOMMENDED_ACTION',
      'TERMINATE_SESSION',
    ] as const;

    it('accepts every one of the 12 baseline intents', () => {
      for (const intent of baselineIntents) {
        const payload = {
          schemaVersion: '1.0.0',
          actionId: `act-${intent}`,
          operationId: `op-${intent}`,
          intent,
          projectId: 'proj-baseline',
          expectedStateRevision: 0,
          parameters: {},
        };
        const result = defaultValidator.validateUIActionEnvelope(payload);
        expect(result.success, `Failed on intent ${intent}`).toBe(true);
      }
    });
  });
});
