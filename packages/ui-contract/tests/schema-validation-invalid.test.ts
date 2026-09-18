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
  it('fails on wrong schemaVersion', () => {
    const fixture = loadFixture('invalid/wrong-schema-version.json');
    const result = defaultValidator.validateUIActionEnvelope(fixture);
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.includes('pattern'))).toBe(true);
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
