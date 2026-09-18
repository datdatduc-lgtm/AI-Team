import type { MigrationStep, MigrationResult } from './migration-types.js';
import type { ContractVersionCategory } from './version-registry.js';

export class MigrationRunner {
  private readonly steps: MigrationStep[] = [];

  public registerStep(step: MigrationStep): void {
    this.steps.push(step);
  }

  public registerSteps(steps: readonly MigrationStep[]): void {
    for (const step of steps) {
      this.registerStep(step);
    }
  }

  public migrate<TInput extends { schemaVersion: string }, TOutput = unknown>(
    category: ContractVersionCategory,
    payload: TInput,
    targetVersion: string
  ): MigrationResult<TOutput> {
    const currentVersion = payload.schemaVersion;
    if (currentVersion === targetVersion) {
      return {
        success: true,
        initialVersion: currentVersion,
        targetVersion,
        appliedSteps: [],
        data: payload as unknown as TOutput,
      };
    }

    const appliedSteps: string[] = [];
    let currentData: unknown = { ...payload };
    let curVer = currentVersion;

    const visited = new Set<string>();

    while (curVer !== targetVersion) {
      if (visited.has(curVer)) {
        return {
          success: false,
          initialVersion: currentVersion,
          targetVersion,
          appliedSteps,
          data: currentData as TOutput,
          error: `Cyclic migration detected at version ${curVer}`,
        };
      }
      visited.add(curVer);

      const nextStep = this.steps.find(
        (s) => s.category === category && s.fromVersion === curVer
      );

      if (!nextStep) {
        return {
          success: false,
          initialVersion: currentVersion,
          targetVersion,
          appliedSteps,
          data: currentData as TOutput,
          error: `No migration path from ${curVer} to ${targetVersion} for category ${category}`,
        };
      }

      try {
        currentData = nextStep.migrate(currentData);
        appliedSteps.push(nextStep.id);
        curVer = nextStep.toVersion;
        if (typeof currentData === 'object' && currentData !== null) {
          (currentData as Record<string, unknown>).schemaVersion = curVer;
        }
      } catch (err) {
        return {
          success: false,
          initialVersion: currentVersion,
          targetVersion,
          appliedSteps,
          data: currentData as TOutput,
          error: `Migration step ${nextStep.id} failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }

    return {
      success: true,
      initialVersion: currentVersion,
      targetVersion,
      appliedSteps,
      data: currentData as TOutput,
    };
  }
}
