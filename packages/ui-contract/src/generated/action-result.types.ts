/* AUTO-GENERATED — DO NOT EDIT */
/* Single Source of Truth: schemas/action-result.schema.json */

/**
 * Result envelope returned synchronously or via ACK for a UIActionEnvelope
 */
export interface ActionResultPayload {
  schemaVersion: string;
  actionId: string;
  operationId: string;
  status: "ACCEPTED" | "REJECTED" | "REQUIRES_APPROVAL" | "CONFLICT" | "UNSUPPORTED";
  operationState?: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
  stateRevision: number;
  reason?: string;
  errors?: string[];
  payload?: {
    [k: string]: unknown | undefined;
  };
  emittedAt: string;
}
