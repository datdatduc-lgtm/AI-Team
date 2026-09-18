/* AUTO-GENERATED — DO NOT EDIT */
/* Single Source of Truth: schemas/goal-state.schema.json */

/**
 * Goal aggregate state (independent from Session state)
 */
export interface GoalStatePayload {
  /**
   * Strict UI Data Contract v1.0.0 schema version
   */
  schemaVersion: "1.0.0";
  goalId: string;
  sessionId: string;
  projectId: string;
  title: string;
  /**
   * Goal lifecycle state
   */
  goalState:
    | "INTAKE"
    | "RESOLVING_CAPABILITIES"
    | "READY"
    | "RUNNING"
    | "PAUSING"
    | "PAUSED"
    | "RECOVERING"
    | "WAITING_FOR_USER"
    | "BLOCKED"
    | "FAILED"
    | "COMPLETED";
  summaryText: string;
  completedTaskCount: number;
  totalTaskCount: number;
  assignedAgentIds: string[];
  stateRevision: number;
  updatedAt: string;
}
