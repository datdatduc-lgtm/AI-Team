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
  });

  it('validates UIActionEnvelope', () => {
    const fixture = loadFixture('valid/ui-action-envelope.valid.json');
    const result = defaultValidator.validateUIActionEnvelope(fixture);
    expect(result.success).toBe(true);
    expect(result.data?.operationId).toBe('op-logical-101');
  });

  it('validates ActionResultPayload', () => {
    const fixture = loadFixture('valid/action-result.valid.json');
    const result = defaultValidator.validateActionResultPayload(fixture);
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('ACCEPTED');
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
    expect(result.data?.status).toBe('RUNNING');
  });

  it('validates AgentStatePayload', () => {
    const fixture = loadFixture('valid/agent-state.valid.json');
    const result = defaultValidator.validateAgentStatePayload(fixture);
    expect(result.success).toBe(true);
    expect(result.data?.healthStatus).toBe('HEALTHY');
  });

  it('validates WorkerStatePayload with OWNED ownership', () => {
    const fixture = loadFixture('valid/worker-state.valid.json');
    const result = defaultValidator.validateWorkerStatePayload(fixture);
    expect(result.success).toBe(true);
    expect(result.data?.ownership).toBe('OWNED');
    expect(result.data?.workState).toBe('WORKING');
  });

  it('validates CapabilityRequirementPayload', () => {
    const fixture = loadFixture('valid/capability-requirement.valid.json');
    const result = defaultValidator.validateCapabilityRequirementPayload(fixture);
    expect(result.success).toBe(true);
    expect(result.data?.resolutionType).toBe('AUTOMATIC');
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
    expect(result.data?.isFocused).toBe(true);
  });

  it('validates SystemRecoveryPayload', () => {
    const fixture = loadFixture('valid/system-recovery.valid.json');
    const result = defaultValidator.validateSystemRecoveryPayload(fixture);
    expect(result.success).toBe(true);
    expect(result.data?.canAutoRecover).toBe(true);
  });

  it('validates RecommendedActionPayload', () => {
    const fixture = loadFixture('valid/recommended-action.valid.json');
    const result = defaultValidator.validateRecommendedActionPayload(fixture);
    expect(result.success).toBe(true);
    expect(result.data?.requiresApproval).toBe(true);
  });
});
