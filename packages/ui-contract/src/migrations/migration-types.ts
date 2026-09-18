import type { ContractVersionCategory } from './version-registry.js';

export interface MigrationStep<TInput = unknown, TOutput = unknown> {
  readonly id: string;
  readonly category: ContractVersionCategory;
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly description: string;
  migrate(input: TInput): TOutput;
}

export interface MigrationResult<T = unknown> {
  readonly success: boolean;
  readonly initialVersion: string;
  readonly targetVersion: string;
  readonly appliedSteps: readonly string[];
  readonly data: T;
  readonly error?: string;
}
