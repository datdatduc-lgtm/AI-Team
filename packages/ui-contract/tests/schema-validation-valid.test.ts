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

describe('UI Contract v1.0.0 Valid Fixtures', () => {
  it('validates CoreEventEnvelope', () => {
    const fixture = loadFixture('valid/core-event-envelope.valid.json');
    const result = defaultValidator.validateCoreEventEnvelope(fixture);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.schemaVersion).toBe('1.0.0');
  });

  it('validates UIActionEnvelope', () => {
    const fixture = loadFixture('valid/ui-action-envelope.valid.json');
    const result = defaultValidator.validateUIActionEnvelope(fixture);
    expect(result.success).toBe(true);
    expect(result.data?.operationId).toBe('op-logical-101');
    expect(result.data?.target?.type).toBe('AGENT');
  });

  it('validates ActionResultPayload', () => {
    const fixture = loadFixture('valid/action-result.valid.json');
    const result = defaultValidator.validateActionResultPayload(fixture);
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('ACCEPTED');
    expect(result.data?.currentStateRevision).toBe(1);
    expect(result.data?.message).toBe('Action accepted by core dispatcher');
  });

  it('validates SessionStatePayload', () => {
    const fixture = loadFixture('valid/session-state.valid.json');
    const result = defaultValidator.validateSessionStatePayload(fixture);
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('READY');
  });

  it('validates GoalStatePayload', () => {
    const fixture = loadFixture('valid/goal-state.valid.json');
    const result = defaultValidator.validateGoalStatePayload(fixture);
    expect(result.success).toBe(true);
    expect(result.data?.goalState).toBe('RUNNING');
    expect(result.data?.completedTaskCount).toBe(4);
    expect(result.data?.totalTaskCount).toBe(10);
    expect(result.data?.summaryText).toBe('Executing contract alignment');
  });

  it('validates AgentStatePayload', () => {
    const fixture = loadFixture('valid/agent-state.valid.json');
    const result = defaultValidator.validateAgentStatePayload(fixture);
    expect(result.success).toBe(true);
    expect(result.data?.healthStatus).toBe('HEALTHY');
    expect(result.data?.agentType).toBe('WEB_AI');
    expect(result.data?.statusSummary).toBe('Ready for instruction');
  });

  it('validates WorkerStatePayload with OWNED ownership', () => {
    const fixture = loadFixture('valid/worker-state.valid.json');
    const result = defaultValidator.validateWorkerStatePayload(fixture);
    expect(result.success).toBe(true);
    expect(result.data?.ownership).toBe('OWNED');
    expect(result.data?.workState).toBe('RUNNING');
    expect(result.data?.displayName).toBe('Worker Process 01');
  });

  it('validates CapabilityRequirementPayload', () => {
    const fixture = loadFixture('valid/capability-requirement.valid.json');
    const result = defaultValidator.validateCapabilityRequirementPayload(fixture);
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('AVAILABLE');
    expect(result.data?.category).toBe('SKILL');
    expect(result.data?.requiredForGoal).toBe(true);
  });

  it('validates HostCapabilityRegistryPayload', () => {
    const fixture = loadFixture('valid/host-capability-registry.valid.json');
    const result = defaultValidator.validateHostCapabilityRegistryPayload(fixture);
    expect(result.success).toBe(true);
    expect(result.data?.capabilities['host.file.openFolder']?.supported).toBe(true);
  });

  it('validates RouteStatePayload', () => {
    const fixture = loadFixture('valid/route-state.valid.json');
    const result = defaultValidator.validateRouteStatePayload(fixture);
    expect(result.success).toBe(true);
    expect(result.data?.semanticState).toBe('READY');
    expect(result.data?.targetAgentId).toBe('agent-codex-01');
    expect(result.data?.statusMessage).toBe('Route target connected and ready');
    expect(result.data?.capturedTargetName).toBe('CodeEditorView');
  });

  it('validates RouteStatePayload when capturedTargetName is null', () => {
    const payload = {
      schemaVersion: '1.0.0',
      routeId: 'route-unattached',
      targetAgentId: 'agent-codex-01',
      semanticState: 'MISSING',
      statusMessage: 'Route target not yet attached',
      capturedTargetName: null,
    };
    const result = defaultValidator.validateRouteStatePayload(payload);
    expect(result.success).toBe(true);
    expect(result.data?.capturedTargetName).toBeNull();
  });

  it('validates SystemRecoveryPayload', () => {
    const fixture = loadFixture('valid/system-recovery.valid.json');
    const result = defaultValidator.validateSystemRecoveryPayload(fixture);
    expect(result.success).toBe(true);
    expect(result.data?.recoveryStatus).toBe('RECOVERING');
    expect(result.data?.target.type).toBe('WORKER');
  });

  it('validates SystemRecoveryPayload when attemptIndex and attemptLimit are null', () => {
    const payload = {
      schemaVersion: '1.0.0',
      target: {
        type: 'WORKER',
        id: 'worker-proc-01',
      },
      whatHappened: 'Worker hung during handshake',
      whatAiTeamIsDoing: 'Evaluating restart safepoint',
      whatUserShouldDo: 'Please wait for recovery',
      recoveryStatus: 'RECOVERING',
      attemptIndex: null,
      attemptLimit: null,
      recommendedActions: [],
    };
    const result = defaultValidator.validateSystemRecoveryPayload(payload);
    expect(result.success).toBe(true);
    expect(result.data?.attemptIndex).toBeNull();
  });

  it('validates RecommendedActionPayload', () => {
    const fixture = loadFixture('valid/recommended-action.valid.json');
    const result = defaultValidator.validateRecommendedActionPayload(fixture);
    expect(result.success).toBe(true);
    expect(result.data?.actionCode).toBe('ENABLE_FILE_ACCESS');
    expect(result.data?.requiresApproval).toBe(true);
  });

  it('validates ActionResultPayload when message is absent or null', () => {
    const payloadAbsent = {
      schemaVersion: '1.0.0',
      actionId: 'act-101',
      operationId: 'op-101',
      status: 'ACCEPTED',
      currentStateRevision: 2,
    };
    const resultAbsent = defaultValidator.validateActionResultPayload(payloadAbsent);
    expect(resultAbsent.success).toBe(true);

    const payloadNull = {
      schemaVersion: '1.0.0',
      actionId: 'act-102',
      operationId: 'op-102',
      status: 'ACCEPTED',
      currentStateRevision: 2,
      message: null,
    };
    const resultNull = defaultValidator.validateActionResultPayload(payloadNull);
    expect(resultNull.success).toBe(true);
  });
});

