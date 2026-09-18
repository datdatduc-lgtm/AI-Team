/* AUTO-GENERATED — DO NOT EDIT */
/* Single Source of Truth: schemas/goal-state.schema.json */

/**
 * Goal aggregate state (independent from Session state)
 */
export interface GoalStatePayload {
  schemaVersion: string;
  goalId: string;
  sessionId: string;
  projectId: string;
  title: string;
  status:
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
  assignedAgentIds: string[];
  progress?: number;
  stateRevision: number;
  updatedAt: string;
}
