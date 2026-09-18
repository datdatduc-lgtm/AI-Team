/* AUTO-GENERATED — DO NOT EDIT */
/* Single Source of Truth: schemas/recommended-action.schema.json */

/**
 * Proactive action recommendation suggested by Core for UI execution
 */
export interface RecommendedActionPayload {
  /**
   * Strict UI Data Contract v1.0.0 schema version
   */
  schemaVersion: "1.0.0";
  actionCode: string;
  targetId: string;
  labelKey: string;
  requiresApproval: boolean;
  payloadParameters?: {
    [k: string]: unknown | undefined;
  };
}
