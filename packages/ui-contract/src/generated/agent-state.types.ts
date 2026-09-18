/* AUTO-GENERATED — DO NOT EDIT */
/* Single Source of Truth: schemas/agent-state.schema.json */

/**
 * Logical AI team member state (independent from Worker managed execution runtime)
 */
export interface AgentStatePayload {
  schemaVersion: string;
  agentId: string;
  displayName: string;
  /**
   * Agent health status (strictly decoupled from worker execution state)
   */
  healthStatus: "HEALTHY" | "DEGRADED" | "UNHEALTHY" | "UNKNOWN";
  selectedForSession: boolean;
  assignedToGoal: boolean;
  sessionRole: string;
  goalRole?: string;
  canContinueWithoutAgent: boolean;
  userActionRequired: boolean;
  userActionPrompt?: string;
  stateRevision: number;
  updatedAt: string;
}
