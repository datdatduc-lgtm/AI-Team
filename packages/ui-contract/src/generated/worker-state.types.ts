/* AUTO-GENERATED — DO NOT EDIT */
/* Single Source of Truth: schemas/worker-state.schema.json */

/**
 * Managed local execution runtime state (independent from Agent logical persona)
 */
export interface WorkerStatePayload {
  /**
   * Strict UI Data Contract v1.0.0 schema version
   */
  schemaVersion: "1.0.0";
  workerId: string;
  displayName: string;
  ownedByAgentId: string;
  currentTaskSummary?: string;
  /**
   * Worker execution state strictly decoupled from agent health status
   */
  workState: "IDLE" | "RUNNING" | "PAUSING_SAFEPOINT" | "PAUSED" | "RECOVERING" | "STUCK" | "TERMINATED";
  supportsPauseSafepoint: boolean;
  /**
   * Strict worker ownership classification
   */
  ownership: "OWNED" | "BORROWED" | "FOREIGN";
  telemetry?: {
    cpuPercent?: number;
    memoryMb?: number;
    uptimeSeconds?: number;
  };
  stateRevision: number;
  updatedAt: string;
}
