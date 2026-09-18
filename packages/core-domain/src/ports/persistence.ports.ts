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
