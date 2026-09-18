/* AUTO-GENERATED — DO NOT EDIT */
/* Single Source of Truth: schemas/ui-action-envelope.schema.json */

/**
 * Envelope for all actions dispatched from UI to Core in AI-Team v1.0.0
 */
export interface UIActionEnvelope {
  schemaVersion: string;
  actionId: string;
  /**
   * Identifies ONE logical operation. Must be reused across retries (timeout, reconnect, lost ACK).
   */
  operationId: string;
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
  projectId: string;
  sessionId?: string;
  goalId?: string;
  expectedStateRevision: number;
  target?: string;
  parameters: {
    [k: string]: unknown | undefined;
  };
}
