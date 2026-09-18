/* AUTO-GENERATED — DO NOT EDIT */
/* Single Source of Truth: schemas/ui-action-envelope.schema.json */

/**
 * Envelope for all actions dispatched from UI to Core in AI-Team v1.0.0
 */
export interface UIActionEnvelope {
  /**
   * Strict UI Data Contract v1.0.0 schema version
   */
  schemaVersion: "1.0.0";
  actionId: string;
  /**
   * Identifies ONE logical operation. Must be reused across retries (timeout, reconnect, lost ACK).
   */
  operationId: string;
  /**
   * Baseline UI action intents
   */
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
  sessionId?: string | null;
  goalId?: string | null;
  expectedStateRevision: number;
  target?: TargetRef | null;
  parameters: {
    [k: string]: unknown | undefined;
  };
}
/**
 * Target entity reference for actions, recovery, and routing
 */
export interface TargetRef {
  type: "AGENT" | "WORKER" | "CAPABILITY" | "ROUTE" | "GOAL";
  id: string;
}
