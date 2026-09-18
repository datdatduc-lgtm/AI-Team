/* AUTO-GENERATED — DO NOT EDIT */
/* Single Source of Truth: schemas/session-state.schema.json */

/**
 * Session aggregate state (independent from Goal state)
 */
export interface SessionStatePayload {
  schemaVersion: string;
  sessionId: string;
  projectId: string;
  status: "OFF" | "STARTING" | "CHECKING_READINESS" | "READY" | "READY_DEGRADED" | "BLOCKED" | "ENDING";
  activeGoalId?: string | null;
  selectedAgentIds: string[];
  stateRevision: number;
  updatedAt: string;
}
