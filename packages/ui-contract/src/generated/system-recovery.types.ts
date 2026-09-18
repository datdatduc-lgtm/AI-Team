/* AUTO-GENERATED — DO NOT EDIT */
/* Single Source of Truth: schemas/system-recovery.schema.json */

/**
 * System recovery state and guidance when recovery is needed
 */
export interface SystemRecoveryPayload {
  schemaVersion: string;
  recoveryId: string;
  triggerReason: string;
  /**
   * @minItems 1
   */
  suggestedActions: [string, ...string[]];
  canAutoRecover: boolean;
  initiatedAt: string;
}
