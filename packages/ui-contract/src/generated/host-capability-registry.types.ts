/* AUTO-GENERATED — DO NOT EDIT */
/* Single Source of Truth: schemas/host-capability-registry.schema.json */

/**
 * Extensible registry of host environment capabilities
 */
export interface HostCapabilityRegistryPayload {
  /**
   * Strict UI Data Contract v1.0.0 schema version
   */
  schemaVersion: "1.0.0";
  capabilities: {
    [k: string]:
      | {
          supported: boolean;
          description?: string;
          metadata?: {
            [k: string]: unknown | undefined;
          };
        }
      | undefined;
  };
}
