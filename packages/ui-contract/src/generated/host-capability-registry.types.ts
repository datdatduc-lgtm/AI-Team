/* AUTO-GENERATED — DO NOT EDIT */
/* Single Source of Truth: schemas/host-capability-registry.schema.json */

/**
 * Extensible registry of host environment capabilities
 */
export interface HostCapabilityRegistryPayload {
  schemaVersion: string;
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
