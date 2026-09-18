/* AUTO-GENERATED — DO NOT EDIT */
/* Single Source of Truth: schemas/capability-requirement.schema.json */

/**
 * Capability requirement required to execute a goal or action
 */
export interface CapabilityRequirementPayload {
  schemaVersion: string;
  requirementId: string;
  capabilityId: string;
  description: string;
  resolved: boolean;
  resolutionType: "AUTOMATIC" | "USER_APPROVAL" | "HOST_PERMISSION" | "UNSUPPORTED";
  resolvedAt?: string;
}
