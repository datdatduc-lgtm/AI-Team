import { describe, it, expect } from 'vitest';
import { defaultValidator } from '../src/validator.js';
import type { UIActionEnvelope } from '../src/generated/index.js';

describe('Protocol Errata: operationId Semantics', () => {
  it('allows identical operationId across multiple action dispatches (retry semantics)', () => {
    const baseAction: UIActionEnvelope = {
      schemaVersion: '1.0.0',
      actionId: 'act-attempt-1',
      operationId: 'op-logical-submit-001',
      intent: 'SUBMIT_GOAL',
      projectId: 'proj-001',
      sessionId: 'sess-001',
      expectedStateRevision: 5,
      parameters: {
        title: 'Fix issue',
      },
    };

    // First attempt validation
    const result1 = defaultValidator.validateUIActionEnvelope(baseAction);
    expect(result1.success).toBe(true);

    // Reconnection / retry attempt (new actionId, same operationId)
    const retryAction: UIActionEnvelope = {
      ...baseAction,
      actionId: 'act-attempt-2-retry-after-timeout',
    };

    const result2 = defaultValidator.validateUIActionEnvelope(retryAction);
    expect(result2.success).toBe(true);
    expect(result2.data?.operationId).toBe(baseAction.operationId);
  });
});
