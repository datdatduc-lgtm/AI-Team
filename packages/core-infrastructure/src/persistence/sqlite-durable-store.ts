import { DatabaseSync } from 'node:sqlite';
import type {
  ActionDedupeRecord,
  ActionDedupeStorePort,
  ActionResultStorePort,
  Clock,
  DurableCommit,
  DurableCommitPort,
  DurableActionCommit,
  DurableActionCommitPort,
  EventStorePort,
  OutboxMessage,
  OutboxPort,
  Snapshot,
  SnapshotStorePort,
  StoredActionResult,
  StoredEvent,
} from '@ai-team/core-domain';

const SCHEMA_VERSION = 2;

function toJson(value: unknown): string {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error('Cannot serialize undefined JSON value.');
  return serialized;
}

function fromJson<T>(value: unknown, label: string): T {
  if (typeof value !== 'string') throw new Error(`Stored ${label} is not valid JSON text.`);
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new Error(`Stored ${label} contains invalid JSON.`, { cause: error });
  }
}

function valueAsNumber(value: unknown, label: string): number {
  if (typeof value !== 'number') throw new Error(`Stored ${label} is not a number.`);
  return value;
}

export class SqliteDurableStore implements EventStorePort, SnapshotStorePort, OutboxPort, ActionDedupeStorePort, ActionResultStorePort, DurableCommitPort, DurableActionCommitPort {
  private readonly database: DatabaseSync;
  private readonly clock: Clock;

  public constructor(databasePath: string, clock: Clock) {
    this.database = new DatabaseSync(databasePath);
    this.clock = clock;
    try {
      this.configureAndInitialize();
    } catch (error) {
      this.database.close();
      throw error;
    }
  }

  public close(): void {
    this.database.close();
  }

  public async append(event: StoredEvent): Promise<void> {
    this.insertEvent(event);
  }

  public async getEventsByProject(projectId: string, fromSequence = 1): Promise<readonly StoredEvent[]> {
    return this.queryEvents('project_id = ? AND sequence >= ?', [projectId, fromSequence]);
  }

  public async getEventsBySession(sessionId: string, fromSequence = 1): Promise<readonly StoredEvent[]> {
    return this.queryEvents('session_id = ? AND sequence >= ?', [sessionId, fromSequence]);
  }

  public async getEventsByGoal(goalId: string, fromSequence = 1): Promise<readonly StoredEvent[]> {
    return this.queryEvents('goal_id = ? AND sequence >= ?', [goalId, fromSequence]);
  }

  public async save(snapshot: Snapshot): Promise<void> {
    this.database.prepare(`
      INSERT INTO snapshots (snapshot_id, aggregate_id, aggregate_type, state_revision, created_at, state_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(snapshot.snapshotId, snapshot.aggregateId, snapshot.aggregateType, snapshot.stateRevision,
      snapshot.createdAt, toJson(snapshot.state));
  }

  public async getLatest(aggregateId: string, aggregateType: string): Promise<Snapshot | null> {
    const row = this.database.prepare(`
      SELECT snapshot_id, aggregate_id, aggregate_type, state_revision, created_at, state_json
      FROM snapshots WHERE aggregate_id = ? AND aggregate_type = ?
      ORDER BY state_revision DESC, snapshot_id ASC LIMIT 1
    `).get(aggregateId, aggregateType) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      snapshotId: String(row.snapshot_id), aggregateId: String(row.aggregate_id),
      aggregateType: String(row.aggregate_type), stateRevision: valueAsNumber(row.state_revision, 'snapshot revision'),
      createdAt: String(row.created_at), state: fromJson(row.state_json, 'snapshot state'),
    };
  }

  public async enqueue(message: OutboxMessage): Promise<void> {
    this.insertOutbox(message);
  }

  public async fetchPending(batchSize: number): Promise<readonly OutboxMessage[]> {
    if (!Number.isInteger(batchSize) || batchSize <= 0) throw new Error('batchSize must be a positive integer.');
    const rows = this.database.prepare(`
      SELECT message_id, topic, payload_json, created_at, dispatched_at
      FROM outbox WHERE dispatched_at IS NULL ORDER BY created_at ASC, message_id ASC LIMIT ?
    `).all(batchSize) as readonly Record<string, unknown>[];
    return rows.map((row) => ({
      messageId: String(row.message_id), topic: String(row.topic), payload: fromJson(row.payload_json, 'outbox payload'),
      createdAt: String(row.created_at), ...(row.dispatched_at === null ? {} : { dispatchedAt: String(row.dispatched_at) }),
    }));
  }

  public async markDispatched(messageIds: readonly string[]): Promise<void> {
    if (messageIds.length === 0) return;
    const timestamp = this.clock.now();
    const statement = this.database.prepare(
      'UPDATE outbox SET dispatched_at = ? WHERE message_id = ? AND dispatched_at IS NULL',
    );
    this.database.exec('BEGIN IMMEDIATE');
    try {
      for (const messageId of messageIds) statement.run(timestamp, messageId);
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  public async find(operationId: string): Promise<ActionDedupeRecord | null> {
    const row = this.database.prepare(`
      SELECT operation_id, action_id, intent, status, first_seen_at, last_seen_at, result_ref, project_id, request_fingerprint
      FROM action_dedupe WHERE operation_id = ?
    `).get(operationId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      operationId: String(row.operation_id), actionId: String(row.action_id), intent: String(row.intent),
      status: row.status as ActionDedupeRecord['status'], firstSeenAt: String(row.first_seen_at),
      lastSeenAt: String(row.last_seen_at), ...(row.result_ref === null ? {} : { resultRef: String(row.result_ref) }),
      ...(row.project_id === null ? {} : { projectId: String(row.project_id) }),
      ...(row.request_fingerprint === null ? {} : { requestFingerprint: String(row.request_fingerprint) }),
    };
  }

  public async record(record: ActionDedupeRecord): Promise<void> {
    this.database.prepare(`
      INSERT INTO action_dedupe (operation_id, action_id, intent, status, first_seen_at, last_seen_at, result_ref, project_id, request_fingerprint)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(record.operationId, record.actionId, record.intent, record.status, record.firstSeenAt,
      record.lastSeenAt, record.resultRef ?? null, record.projectId ?? null, record.requestFingerprint ?? null);
  }

  public async getByResultId(resultId: string): Promise<StoredActionResult | null> {
    const row = this.database.prepare('SELECT payload_json FROM action_results WHERE result_id = ?').get(resultId) as Record<string, unknown> | undefined;
    return row ? fromJson<StoredActionResult>(row.payload_json, 'action result') : null;
  }

  public async getByOperationId(operationId: string): Promise<StoredActionResult | null> {
    const row = this.database.prepare('SELECT payload_json FROM action_results WHERE operation_id = ?').get(operationId) as Record<string, unknown> | undefined;
    return row ? fromJson<StoredActionResult>(row.payload_json, 'action result') : null;
  }

  public async updateStatus(operationId: string, status: ActionDedupeRecord['status'], resultRef?: string): Promise<void> {
    const result = resultRef === undefined
      ? this.database.prepare('UPDATE action_dedupe SET status = ?, last_seen_at = ? WHERE operation_id = ?')
        .run(status, this.clock.now(), operationId)
      : this.database.prepare('UPDATE action_dedupe SET status = ?, last_seen_at = ?, result_ref = ? WHERE operation_id = ?')
        .run(status, this.clock.now(), resultRef, operationId);
    if (result.changes !== 1) throw new Error(`Cannot update missing operationId: ${operationId}.`);
  }

  public async commitEventAndOutbox(commit: DurableCommit): Promise<void> {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      this.insertEvent(commit.event);
      for (const message of commit.outboxMessages) this.insertOutbox(message);
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  public async commitAction(commit: DurableActionCommit): Promise<void> {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      this.insertActionDedupe(commit.dedupeRecord);
      this.insertActionResult(commit.actionResult);
      if (commit.event) this.insertEvent(commit.event);
      for (const message of commit.outboxMessages) this.insertOutbox(message);
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  private configureAndInitialize(): void {
    this.database.exec('PRAGMA foreign_keys = ON');
    this.database.exec('PRAGMA journal_mode = WAL');
    this.database.exec('PRAGMA synchronous = FULL');
    const row = this.database.prepare('PRAGMA user_version').get() as Record<string, unknown>;
    const version = valueAsNumber(Object.values(row)[0], 'schema version');
    if (version > SCHEMA_VERSION) {
      throw new Error(`Unsupported SQLite schema version: ${version}.`);
    }
    if (version === 0) this.createSchema();
    if (version === 1) this.migrateV1ToV2();
  }

  private createSchema(): void {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      this.database.exec(`
        CREATE TABLE events (
          event_id TEXT PRIMARY KEY,
          event_type TEXT NOT NULL,
          emitted_at TEXT NOT NULL,
          project_id TEXT NOT NULL,
          session_id TEXT,
          goal_id TEXT,
          state_revision INTEGER NOT NULL CHECK (state_revision > 0),
          sequence INTEGER NOT NULL CHECK (sequence > 0),
          payload_json TEXT NOT NULL,
          UNIQUE (project_id, sequence),
          UNIQUE (project_id, state_revision)
        );
        CREATE INDEX events_project_sequence ON events(project_id, sequence);
        CREATE INDEX events_session_sequence ON events(session_id, sequence);
        CREATE INDEX events_goal_sequence ON events(goal_id, sequence);
        CREATE TABLE snapshots (
          snapshot_id TEXT PRIMARY KEY,
          aggregate_id TEXT NOT NULL,
          aggregate_type TEXT NOT NULL,
          state_revision INTEGER NOT NULL CHECK (state_revision > 0),
          created_at TEXT NOT NULL,
          state_json TEXT NOT NULL
        );
        CREATE INDEX snapshots_aggregate ON snapshots(aggregate_id, aggregate_type, state_revision);
        CREATE TABLE outbox (
          message_id TEXT PRIMARY KEY,
          topic TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          dispatched_at TEXT
        );
        CREATE TABLE action_dedupe (
          operation_id TEXT PRIMARY KEY,
          action_id TEXT NOT NULL,
          intent TEXT NOT NULL,
          status TEXT NOT NULL,
          first_seen_at TEXT NOT NULL,
          last_seen_at TEXT NOT NULL,
          result_ref TEXT,
          project_id TEXT,
          request_fingerprint TEXT
        );
        CREATE TABLE action_results (
          result_id TEXT PRIMARY KEY,
          operation_id TEXT UNIQUE NOT NULL,
          action_id TEXT NOT NULL,
          status TEXT NOT NULL,
          current_state_revision INTEGER NOT NULL,
          payload_json TEXT NOT NULL,
          emitted_at TEXT NOT NULL
        );
      `);
      this.database.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  private migrateV1ToV2(): void {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      this.database.exec('ALTER TABLE action_dedupe ADD COLUMN project_id TEXT');
      this.database.exec('ALTER TABLE action_dedupe ADD COLUMN request_fingerprint TEXT');
      this.createActionResultsTable();
      this.database.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  private insertEvent(event: StoredEvent): void {
    this.database.prepare(`
      INSERT INTO events (event_id, event_type, emitted_at, project_id, session_id, goal_id, state_revision, sequence, payload_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(event.eventId, event.eventType, event.emittedAt, event.projectId, event.sessionId ?? null,
      event.goalId ?? null, event.stateRevision, event.sequence, toJson(event.payload));
  }

  private insertActionDedupe(record: ActionDedupeRecord): void {
    this.database.prepare(`
      INSERT INTO action_dedupe (operation_id, action_id, intent, status, first_seen_at, last_seen_at, result_ref, project_id, request_fingerprint)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(record.operationId, record.actionId, record.intent, record.status, record.firstSeenAt,
      record.lastSeenAt, record.resultRef ?? null, record.projectId ?? null, record.requestFingerprint ?? null);
  }

  private insertActionResult(result: StoredActionResult): void {
    this.database.prepare(`
      INSERT INTO action_results (result_id, operation_id, action_id, status, current_state_revision, payload_json, emitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(result.resultId, result.operationId, result.actionId, result.status, result.currentStateRevision,
      toJson(result), result.emittedAt);
  }

  private createActionResultsTable(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS action_results (
        result_id TEXT PRIMARY KEY,
        operation_id TEXT UNIQUE NOT NULL,
        action_id TEXT NOT NULL,
        status TEXT NOT NULL,
        current_state_revision INTEGER NOT NULL,
        payload_json TEXT NOT NULL,
        emitted_at TEXT NOT NULL
      );
    `);
  }

  private insertOutbox(message: OutboxMessage): void {
    this.database.prepare(`
      INSERT INTO outbox (message_id, topic, payload_json, created_at, dispatched_at) VALUES (?, ?, ?, ?, ?)
    `).run(message.messageId, message.topic, toJson(message.payload), message.createdAt, message.dispatchedAt ?? null);
  }

  private queryEvents(where: string, parameters: readonly (string | number)[]): readonly StoredEvent[] {
    const rows = this.database.prepare(`
      SELECT event_id, event_type, emitted_at, project_id, session_id, goal_id, state_revision, sequence, payload_json
      FROM events WHERE ${where} ORDER BY sequence ASC
    `).all(...parameters) as readonly Record<string, unknown>[];
    return rows.map((row) => ({
      eventId: String(row.event_id), eventType: String(row.event_type), emittedAt: String(row.emitted_at),
      projectId: String(row.project_id), ...(row.session_id === null ? {} : { sessionId: String(row.session_id) }),
      ...(row.goal_id === null ? {} : { goalId: String(row.goal_id) }),
      stateRevision: valueAsNumber(row.state_revision, 'event revision'), sequence: valueAsNumber(row.sequence, 'event sequence'),
      payload: fromJson(row.payload_json, 'event payload'),
    }));
  }
}