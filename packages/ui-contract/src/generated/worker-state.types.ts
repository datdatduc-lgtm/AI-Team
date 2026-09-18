/* AUTO-GENERATED — DO NOT EDIT */
/* Single Source of Truth: schemas/worker-state.schema.json */

/**
 * Managed local execution runtime state (independent from Agent logical persona)
 */
export interface WorkerStatePayload {
  schemaVersion: string;
  workerId: string;
  ownedByAgentId: string;
  currentTaskSummary?: string;
  /**
   * Runtime execution work state (strictly decoupled from health status)
   */
  workState: "IDLE" | "WORKING" | "PAUSED" | "STOPPED" | "DRAINING";
  supportsPauseSafepoint: boolean;
  /**
   * Strict worker process ownership classification
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
