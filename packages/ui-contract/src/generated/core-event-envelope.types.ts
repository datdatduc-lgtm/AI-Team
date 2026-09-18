/* AUTO-GENERATED — DO NOT EDIT */
/* Single Source of Truth: schemas/core-event-envelope.schema.json */

/**
 * Envelope for all events dispatched by Core to UI in AI-Team v1.0.0
 */
export interface CoreEventEnvelope {
  /**
   * Strict UI Data Contract v1.0.0 schema version
   */
  schemaVersion: "1.0.0";
  eventId: string;
  /**
   * Strict core event type classification
   */
  eventType:
    | "SESSION_STATE_CHANGED"
    | "GOAL_STATE_CHANGED"
    | "AGENT_STATE_CHANGED"
    | "WORKER_STATE_CHANGED"
    | "CAPABILITY_STATE_CHANGED"
    | "ROUTE_STATE_CHANGED"
    | "SYSTEM_RECOVERY_TRIGGERED"
    | "ACTION_RESULT_EMITTED";
  emittedAt: string;
  projectId: string;
  sessionId?: string | null;
  goalId?: string | null;
  stateRevision: number;
  sequence: number;
  payload: {
    [k: string]: unknown | undefined;
  };
}
