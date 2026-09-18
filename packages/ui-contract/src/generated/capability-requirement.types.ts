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
  capabilityName: string;
  /**
   * Capability classification category
   */
  category: "SKILL" | "PLUGIN_MCP" | "APP_CONNECTION" | "MODEL";
  requiredForGoal: boolean;
  /**
   * Capability availability status
   */
  status: "AVAILABLE" | "DISABLED" | "UNCONFIGURED" | "MISSING" | "INCOMPATIBLE";
  selectedProviderId?: string | null;
  alternatives: string[];
  recommendedActions: RecommendedActionRef[];
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
