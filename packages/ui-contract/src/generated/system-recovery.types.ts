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
  recoveryId: string;
  target: TargetRef;
  /**
   * System recovery status
   */
  status: "RECOVERING" | "WAITING_FOR_USER" | "BLOCKED" | "FAILED";
  whatHappened: string;
  whatAiTeamIsDoing: string;
  whatUserShouldDo: string;
  recommendedActions: RecommendedActionRef[];
  canAutoRecover: boolean;
  initiatedAt: string;
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
