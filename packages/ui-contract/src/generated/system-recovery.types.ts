/* AUTO-GENERATED — DO NOT EDIT */
/* Single Source of Truth: schemas/system-recovery.schema.json */

/**
 * System recovery state and guidance when recovery is needed
 */
export interface SystemRecoveryPayload {
  /**
   * Strict UI Data Contract v1.0.0 schema version
   */
  schemaVersion: "1.0.0";
  target: TargetRef;
  whatHappened: string;
  whatAiTeamIsDoing: string;
  whatUserShouldDo: string;
  /**
   * System recovery status
   */
  recoveryStatus: "RECOVERING" | "WAITING_FOR_USER" | "BLOCKED" | "FAILED";
  attemptIndex?: number | null;
  attemptLimit?: number | null;
  recommendedActions: RecommendedActionRef[];
}
/**
 * Target entity reference for actions, recovery, and routing
 */
export interface TargetRef {
  type: "AGENT" | "WORKER" | "CAPABILITY" | "ROUTE" | "GOAL";
  id: string;
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
