/* AUTO-GENERATED — DO NOT EDIT */
/* Single Source of Truth: schemas/capability-requirement.schema.json */

/**
 * Capability requirement required to execute a goal or action
 */
export interface CapabilityRequirementPayload {
  /**
   * Strict UI Data Contract v1.0.0 schema version
   */
  schemaVersion: "1.0.0";
  requirementId: string;
  capabilityId: string;
  capabilityName: string;
  /**
   * Capability classification category
   */
  category: "HOST" | "MODEL" | "TOOL" | "INTEGRATION" | "SYSTEM";
  description: string;
  /**
   * Capability availability status
   */
  status: "AVAILABLE" | "DISABLED" | "UNCONFIGURED" | "MISSING" | "INCOMPATIBLE";
  resolutionType: "AUTOMATIC" | "USER_APPROVAL" | "HOST_PERMISSION" | "UNSUPPORTED";
  alternatives: string[];
  recommendedActions: RecommendedActionRef[];
  resolvedAt?: string;
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
