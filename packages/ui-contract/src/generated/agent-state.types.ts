/* AUTO-GENERATED — DO NOT EDIT */
/* Single Source of Truth: schemas/agent-state.schema.json */

/**
 * Logical AI team member state (independent from Worker managed execution runtime)
 */
export interface AgentStatePayload {
  /**
   * Strict UI Data Contract v1.0.0 schema version
   */
  schemaVersion: "1.0.0";
  agentId: string;
  displayName: string;
  /**
   * Classification of agent member type
   */
  agentType: "WEB_AI" | "MANAGED_LOCAL_AGENT";
  /**
   * Agent health status strictly decoupled from worker execution state
   */
  healthStatus: "HEALTHY" | "DEGRADED" | "DISCONNECTED" | "OFF";
  statusSummary: string;
  selectedForSession: boolean;
  assignedToGoal: boolean;
  sessionRole: string;
  goalRole?: string;
  canContinueWithoutAgent: boolean;
  userActionRequired: boolean;
  userActionPrompt?: string;
  recommendedActions: RecommendedActionRef[];
  stateRevision: number;
  updatedAt: string;
}
/**
 * Recommended action definition
 */
export interface RecommendedActionRef {
  actionCode: string;
  targetId: string;
  labelKey: string;
  requiresApproval: boolean;
  payloadParameters?: {
    [k: string]: unknown | undefined;
  };
}
