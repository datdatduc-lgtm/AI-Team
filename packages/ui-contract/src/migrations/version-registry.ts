/**
 * Protocol version registry separating UI Contract, Event Schema, Snapshot Schema, and DB Schema.
 */
export const CONTRACT_VERSIONS = {
  UI_CONTRACT: '1.0.0',
  EVENT_SCHEMA: '1.0.0',
  SNAPSHOT_SCHEMA: '1.0.0',
  DATABASE_SCHEMA: '1.0.0',
} as const;

export type ContractVersionCategory = keyof typeof CONTRACT_VERSIONS;
