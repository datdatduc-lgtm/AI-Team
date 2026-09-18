/* AUTO-GENERATED — DO NOT EDIT */
/* Single Source of Truth: schemas/recommended-action.schema.json */

/**
 * Proactive action recommendation suggested by Core for UI execution
 */
export interface RecommendedActionPayload {
  schemaVersion: string;
  recommendationId: string;
  title: string;
  intent:
    | "INITIALIZE_AI_TEAM"
    | "SET_SESSION_TEAM"
    | "CHECK_SESSION_READINESS"
    | "CAPTURE_FOCUSED_ROUTE"
    | "SUBMIT_GOAL"
    | "ENABLE_CAPABILITY"
    | "RESOLVE_CAPABILITY_REQUIREMENT"
    | "START_GOAL_EXECUTION"
    | "STOP_CURRENT_GOAL"
    | "PAUSE_WORKER_SAFEPOINT"
    | "EXECUTE_RECOMMENDED_ACTION"
    | "TERMINATE_SESSION";
  parameters: {
    [k: string]: unknown | undefined;
  };
  reason: string;
  confidenceScore: number;
  requiresApproval: boolean;
}
