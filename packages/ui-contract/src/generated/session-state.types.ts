/* AUTO-GENERATED — DO NOT EDIT */
/* Single Source of Truth: schemas/session-state.schema.json */

/**
 * Session aggregate state (independent from Goal state)
 */
export interface SessionStatePayload {
  /**
   * Strict UI Data Contract v1.0.0 schema version
   */
  schemaVersion: "1.0.0";
  sessionId: string;
  projectId: string;
  /**
   * Session lifecycle state
   */
  status: "OFF" | "STARTING" | "CHECKING_READINESS" | "READY" | "READY_DEGRADED" | "BLOCKED" | "ENDING";
  activeGoalId?: string | null;
  selectedAgentIds: string[];
  stateRevision: number;
  updatedAt: string;
}
