/* AUTO-GENERATED — DO NOT EDIT */
/* Single Source of Truth: schemas/action-result.schema.json */

/**
 * Result envelope returned synchronously or via ACK for a UIActionEnvelope
 */
export interface ActionResultPayload {
  /**
   * Strict UI Data Contract v1.0.0 schema version
   */
  schemaVersion: "1.0.0";
  actionId: string;
  operationId: string;
  /**
   * Action admission result status
   */
  status: "ACCEPTED" | "REJECTED" | "REQUIRES_APPROVAL" | "CONFLICT" | "UNSUPPORTED";
  currentStateRevision: number;
  message?: string | null;
  rejectionReason?: string | null;
  errors?: string[];
  payload?: {
    [k: string]: unknown | undefined;
  };
  emittedAt?: string;
}
