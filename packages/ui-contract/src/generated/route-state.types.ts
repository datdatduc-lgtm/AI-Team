/* AUTO-GENERATED — DO NOT EDIT */
/* Single Source of Truth: schemas/route-state.schema.json */

/**
 * Host and application route focus and view state
 */
export interface RouteStatePayload {
  /**
   * Strict UI Data Contract v1.0.0 schema version
   */
  schemaVersion: "1.0.0";
  routeId: string;
  targetAgentId: string;
  /**
   * Semantic route state
   */
  semanticState: "CONFIGURED" | "VERIFYING" | "READY" | "AUTH_REQUIRED" | "WRONG_CONVERSATION" | "MISSING" | "BROKEN";
  statusMessage: string;
  capturedTargetName: string | null;
  metadata?: {
    [k: string]: unknown | undefined;
  };
}
