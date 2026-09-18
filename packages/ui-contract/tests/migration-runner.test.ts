import { describe, it, expect } from 'vitest';
import { MigrationRunner } from '../src/migrations/migration-runner.js';
import type { MigrationStep } from '../src/migrations/migration-types.js';

describe('Schema Migration Framework', () => {
  it('returns data unchanged when targetVersion matches initialVersion', () => {
    const runner = new MigrationRunner();
    const payload = { schemaVersion: '1.0.0', key: 'value' };

    const result = runner.migrate('UI_CONTRACT', payload, '1.0.0');
    expect(result.success).toBe(true);
    expect(result.appliedSteps).toHaveLength(0);
    expect(result.data).toEqual(payload);
  });

  it('runs sequential migration steps from v1.0.0 to v1.2.0', () => {
    const runner = new MigrationRunner();

    const step1: MigrationStep<any, any> = {
      id: 'step-1.0.0-to-1.1.0',
      category: 'UI_CONTRACT',
      fromVersion: '1.0.0',
      toVersion: '1.1.0',
      description: 'Add metadata field',
      migrate: (input) => ({
        ...input,
        metadata: { migrated: true },
      }),
    };

    const step2: MigrationStep<any, any> = {
      id: 'step-1.1.0-to-1.2.0',
      category: 'UI_CONTRACT',
      fromVersion: '1.1.0',
      toVersion: '1.2.0',
      description: 'Add flags array',
      migrate: (input) => ({
        ...input,
        flags: ['STABLE'],
      }),
    };

    runner.registerSteps([step1, step2]);

    const initial = { schemaVersion: '1.0.0', sessionId: 'sess-01' };
    const result = runner.migrate('UI_CONTRACT', initial, '1.2.0');

    expect(result.success).toBe(true);
    expect(result.initialVersion).toBe('1.0.0');
    expect(result.targetVersion).toBe('1.2.0');
    expect(result.appliedSteps).toEqual(['step-1.0.0-to-1.1.0', 'step-1.1.0-to-1.2.0']);
    expect(result.data).toEqual({
      schemaVersion: '1.2.0',
      sessionId: 'sess-01',
      metadata: { migrated: true },
      flags: ['STABLE'],
    });
  });

  it('returns failure when no migration path exists', () => {
    const runner = new MigrationRunner();
    const payload = { schemaVersion: '1.0.0', key: 'test' };

    const result = runner.migrate('UI_CONTRACT', payload, '2.0.0');
    expect(result.success).toBe(false);
    expect(result.error).toContain('No migration path');
  });

  it('detects and halts on cyclic migration definitions', () => {
    const runner = new MigrationRunner();

    const step1: MigrationStep<any, any> = {
      id: 'step-cycle-a',
      category: 'EVENT_SCHEMA',
      fromVersion: '1.0.0',
      toVersion: '1.1.0',
      description: 'Cycle step A',
      migrate: (i) => i,
    };
    const step2: MigrationStep<any, any> = {
      id: 'step-cycle-b',
      category: 'EVENT_SCHEMA',
      fromVersion: '1.1.0',
      toVersion: '1.0.0',
      description: 'Cycle step B',
      migrate: (i) => i,
    };

    runner.registerSteps([step1, step2]);

    const result = runner.migrate('EVENT_SCHEMA', { schemaVersion: '1.0.0' }, '1.2.0');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Cyclic migration detected');
  });
});
