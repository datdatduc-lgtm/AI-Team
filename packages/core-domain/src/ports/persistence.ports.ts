export interface StoredEvent<T = unknown> {
  readonly eventId: string;
  readonly eventType: string;
  readonly emittedAt: string;
  readonly projectId: string;
  readonly sessionId?: string;
  readonly goalId?: string;
  readonly stateRevision: number;
  readonly sequence: number;
  readonly payload: T;
}

export interface EventStorePort {
  append(event: StoredEvent): Promise<void>;
  getEventsByProject(projectId: string, fromSequence?: number): Promise<readonly StoredEvent[]>;
  getEventsBySession(sessionId: string, fromSequence?: number): Promise<readonly StoredEvent[]>;
  getEventsByGoal(goalId: string, fromSequence?: number): Promise<readonly StoredEvent[]>;
}

export interface DurableCommit {
  readonly event: StoredEvent;
  readonly outboxMessages: readonly OutboxMessage[];
}

export interface DurableCommitPort {
  commitEventAndOutbox(commit: DurableCommit): Promise<void>;
}

export interface Snapshot<T = unknown> {
  readonly snapshotId: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly stateRevision: number;
  readonly createdAt: string;
  readonly state: T;
}

export interface SnapshotStorePort {
  save(snapshot: Snapshot): Promise<void>;
  getLatest(aggregateId: string, aggregateType: string): Promise<Snapshot | null>;
}

export type DedupeStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COMPLETED';

export interface ActionDedupeRecord {
  readonly operationId: string;
  readonly actionId: string;
  readonly intent: string;
  readonly status: DedupeStatus;
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
  readonly resultRef?: string;
  readonly projectId?: string;
  readonly requestFingerprint?: string;
}

export interface StoredActionResult {
  readonly resultId: string;
  readonly operationId: string;
  readonly actionId: string;
  readonly status: 'ACCEPTED' | 'REJECTED' | 'REQUIRES_APPROVAL' | 'CONFLICT' | 'UNSUPPORTED';
  readonly currentStateRevision: number;
  readonly message?: string;
  readonly rejectionReason?: string;
  readonly errors?: readonly string[];
  readonly payload?: Readonly<Record<string, unknown>>;
  readonly emittedAt: string;
}

export interface ActionResultStorePort {
  getByResultId(resultId: string): Promise<StoredActionResult | null>;
  getByOperationId(operationId: string): Promise<StoredActionResult | null>;
}

export interface DurableActionCommit {
  readonly dedupeRecord: ActionDedupeRecord;
  readonly actionResult: StoredActionResult;
  readonly event?: StoredEvent;
  readonly outboxMessages: readonly OutboxMessage[];
}

export interface DurableActionCommitPort {
  commitAction(commit: DurableActionCommit): Promise<void>;
}

export interface ActionDedupeStorePort {
  find(operationId: string): Promise<ActionDedupeRecord | null>;
  record(record: ActionDedupeRecord): Promise<void>;
  updateStatus(operationId: string, status: DedupeStatus, resultRef?: string): Promise<void>;
}

export interface OutboxMessage<T = unknown> {
  readonly messageId: string;
  readonly topic: string;
  readonly payload: T;
  readonly createdAt: string;
  readonly dispatchedAt?: string;
}

export interface OutboxPort {
  enqueue(message: OutboxMessage): Promise<void>;
  fetchPending(batchSize: number): Promise<readonly OutboxMessage[]>;
  markDispatched(messageIds: readonly string[]): Promise<void>;
}
