import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createInitialProjectState,
  reduceAllProjectEvents,
  type ActionDedupeRecord,
  type Clock,
  type DomainEvent,
  type DurableActionCommit,
  type ProjectState,
  type Snapshot,
  type StoredActionResult,
  type StoredEvent,
} from '@ai-team/core-domain';
import { SqliteDurableStore } from '@ai-team/core-infrastructure';

const paths: string[] = [];
const clock: Clock = { now: () => '2026-09-19T00:00:00.000Z' };

afterEach(async () => {
  for (const path of paths.splice(0)) await rm(path, { recursive: true, force: true });
});

async function makeDatabase(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'ai-team-p0-3-'));
  paths.push(directory);
  return join(directory, 'events.sqlite');
}

function event(sequence: number, projectId = 'project-A'): StoredEvent {
  const state = ['STARTING', 'CHECKING_READINESS', 'READY', 'ENDING', 'OFF', 'STARTING'][sequence - 1];
  return {
    eventId: `${projectId}-event-${sequence}`,
    eventType: 'SESSION_STATE_CHANGED',
    emittedAt: `2026-09-19T00:00:0${sequence}.000Z`,
    projectId,
    sessionId: `${projectId}-session`,
    stateRevision: sequence,
    sequence,
    payload: { state },
  };
}

function replay(initial: ProjectState, events: readonly StoredEvent[]): ProjectState {
  const result = reduceAllProjectEvents(initial, events.map((stored) => stored as unknown as DomainEvent));
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}

function snapshot(state: ProjectState): Snapshot<ProjectState> {
  return {
    snapshotId: `snapshot-${state.sequence}`,
    aggregateId: state.projectId,
    aggregateType: 'PROJECT',
    stateRevision: state.stateRevision,
    createdAt: '2026-09-19T00:00:10.000Z',
    state,
  };
}

describe('P0.3 SQLite durable persistence', () => {
  it('restarts and deterministically replays the durable event ledger', async () => {
    const databasePath = await makeDatabase();
    const first = new SqliteDurableStore(databasePath, clock);
    const events = [event(1), event(2), event(3), event(4), event(5)];
    for (const item of events) await first.append(item);
    const expected = replay(createInitialProjectState('project-A'), events);
    first.close();

    const second = new SqliteDurableStore(databasePath, clock);
    const restored = replay(createInitialProjectState('project-A'), await second.getEventsByProject('project-A'));
    expect(restored).toEqual(expected);
    second.close();
  });

  it('loads a snapshot and replays only the tail to the full replay result', async () => {
    const databasePath = await makeDatabase();
    const store = new SqliteDurableStore(databasePath, clock);
    const events = [event(1), event(2), event(3), event(4), event(5), event(6)];
    for (const item of events) await store.append(item);
    const checkpoint = replay(createInitialProjectState('project-A'), events.slice(0, 4));
    await store.save(snapshot(checkpoint));
    const full = replay(createInitialProjectState('project-A'), events);
    store.close();

    const reopened = new SqliteDurableStore(databasePath, clock);
    const latest = await reopened.getLatest('project-A', 'PROJECT');
    expect(latest?.state.projectId).toBe('project-A');
    expect(latest?.stateRevision).toBe(latest?.state.stateRevision);
    expect(latest?.state.sequence).toBe(4);
    const tail = await reopened.getEventsByProject('project-A', (latest?.state.sequence ?? 0) + 1);
    expect(replay(latest?.state ?? createInitialProjectState('missing'), tail)).toEqual(full);
    reopened.close();
  });

  it('isolates project queries and orders each project by sequence, not row order', async () => {
    const store = new SqliteDurableStore(await makeDatabase(), clock);
    await store.append(event(1, 'project-B'));
    await store.append(event(2, 'project-A'));
    await store.append(event(1, 'project-A'));
    expect((await store.getEventsByProject('project-A')).map((item) => item.sequence)).toEqual([1, 2]);
    expect((await store.getEventsByProject('project-B')).map((item) => item.projectId)).toEqual(['project-B']);
    store.close();
  });

  it('rejects duplicate event identity, sequence, revision, snapshot, and dedupe identity', async () => {
    const store = new SqliteDurableStore(await makeDatabase(), clock);
    await store.append(event(1));
    await expect(store.append({ ...event(1), eventId: 'different-id' })).rejects.toThrow();
    await expect(store.append({ ...event(1), eventId: 'different-id-2', stateRevision: 2 })).rejects.toThrow();
    await expect(store.append({ ...event(1), eventId: 'different-id-3', sequence: 2 })).rejects.toThrow();
    const saved = snapshot(replay(createInitialProjectState('project-A'), [event(1)]));
    await store.save(saved);
    await expect(store.save(saved)).rejects.toThrow();
    const record: ActionDedupeRecord = {
      operationId: 'operation-1', actionId: 'action-1', intent: 'test', status: 'PENDING',
      firstSeenAt: clock.now(), lastSeenAt: clock.now(),
    };
    await store.record(record);
    await expect(store.record(record)).rejects.toThrow();
    store.close();
  });

  it('commits event and outbox atomically and rolls back on a duplicate message', async () => {
    const store = new SqliteDurableStore(await makeDatabase(), clock);
    const message = { messageId: 'message-1', topic: 'domain.event', payload: { ok: true }, createdAt: clock.now() };
    await store.enqueue(message);
    await expect(store.commitEventAndOutbox({ event: event(1), outboxMessages: [message] })).rejects.toThrow();
    expect(await store.getEventsByProject('project-A')).toEqual([]);
    expect((await store.fetchPending(10)).map((item) => item.messageId)).toEqual(['message-1']);
    store.close();
  });

  it('rolls back the complete durable action commit when outbox insertion fails', async () => {
    const store = new SqliteDurableStore(await makeDatabase(), clock);
    const message = { messageId: 'message-duplicate', topic: 'domain.event', payload: { old: true }, createdAt: clock.now() };
    await store.enqueue(message);
    const result: StoredActionResult = { resultId: 'result-new', operationId: 'operation-new', actionId: 'action-new', status: 'ACCEPTED', currentStateRevision: 1, emittedAt: clock.now() };
    const commit: DurableActionCommit = {
      dedupeRecord: { operationId: 'operation-new', actionId: 'action-new', intent: 'test', status: 'ACCEPTED', firstSeenAt: clock.now(), lastSeenAt: clock.now(), resultRef: result.resultId, projectId: 'project-A', requestFingerprint: 'fingerprint-new' },
      actionResult: result, event: event(1), outboxMessages: [message],
    };
    await expect(store.commitAction(commit)).rejects.toThrow();
    expect(await store.find('operation-new')).toBeNull(); expect(await store.getByOperationId('operation-new')).toBeNull();
    expect(await store.getEventsByProject('project-A')).toEqual([]); expect(await store.fetchPending(10)).toEqual([message]);
    store.close();
  });

  it('persists ordered outbox state and uses one clock value per dispatch batch', async () => {
    let ticks = 0;
    const tickingClock: Clock = { now: () => `2026-09-19T00:00:0${++ticks}.000Z` };
    const databasePath = await makeDatabase();
    const store = new SqliteDurableStore(databasePath, tickingClock);
    await store.enqueue({ messageId: 'm1', topic: 't', payload: 1, createdAt: '2026-09-19T00:00:01.000Z' });
    await store.enqueue({ messageId: 'm2', topic: 't', payload: 2, createdAt: '2026-09-19T00:00:02.000Z' });
    await store.enqueue({ messageId: 'm3', topic: 't', payload: 3, createdAt: '2026-09-19T00:00:03.000Z' });
    await expect(store.fetchPending(0)).rejects.toThrow(/positive/);
    expect((await store.fetchPending(2)).map((item) => item.messageId)).toEqual(['m1', 'm2']);
    await store.markDispatched(['m1', 'm1']);
    expect((await store.fetchPending(10)).map((item) => item.messageId)).toEqual(['m2', 'm3']);
    await store.markDispatched(['m2', 'm3']);
    store.close();
    const reopened = new SqliteDurableStore(databasePath, tickingClock);
    expect(await reopened.fetchPending(10)).toEqual([]);
    reopened.close();
  });

  it('persists dedupe records through close/reopen and rejects missing updates', async () => {
    const databasePath = await makeDatabase();
    const record: ActionDedupeRecord = {
      operationId: 'operation-1', actionId: 'action-1', intent: 'intent', status: 'PENDING',
      firstSeenAt: clock.now(), lastSeenAt: clock.now(),
    };
    const store = new SqliteDurableStore(databasePath, clock);
    await store.record(record);
    store.close();
    const reopened = new SqliteDurableStore(databasePath, clock);
    expect(await reopened.find(record.operationId)).toEqual(record);
    await reopened.updateStatus(record.operationId, 'COMPLETED', 'result-1');
    expect(await reopened.find(record.operationId)).toMatchObject({ status: 'COMPLETED', resultRef: 'result-1' });
    await expect(reopened.updateStatus('missing', 'REJECTED')).rejects.toThrow(/missing/);
    reopened.close();
  });

  it('migrates a v1 database without dropping events or dedupe records', async () => {
    const databasePath = await makeDatabase(); const database = new DatabaseSync(databasePath);
    database.exec(`
      CREATE TABLE events (event_id TEXT PRIMARY KEY, event_type TEXT NOT NULL, emitted_at TEXT NOT NULL, project_id TEXT NOT NULL, session_id TEXT, goal_id TEXT, state_revision INTEGER NOT NULL, sequence INTEGER NOT NULL, payload_json TEXT NOT NULL, UNIQUE(project_id, sequence), UNIQUE(project_id, state_revision));
      CREATE TABLE snapshots (snapshot_id TEXT PRIMARY KEY, aggregate_id TEXT NOT NULL, aggregate_type TEXT NOT NULL, state_revision INTEGER NOT NULL, created_at TEXT NOT NULL, state_json TEXT NOT NULL);
      CREATE TABLE outbox (message_id TEXT PRIMARY KEY, topic TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL, dispatched_at TEXT);
      CREATE TABLE action_dedupe (operation_id TEXT PRIMARY KEY, action_id TEXT NOT NULL, intent TEXT NOT NULL, status TEXT NOT NULL, first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, result_ref TEXT);
      INSERT INTO events VALUES ('old-event', 'SESSION_STATE_CHANGED', '${clock.now()}', 'project-A', NULL, NULL, 1, 1, '{"state":"STARTING"}');
      INSERT INTO action_dedupe VALUES ('old-operation', 'old-action', 'test', 'PENDING', '${clock.now()}', '${clock.now()}', NULL);
      PRAGMA user_version = 1;
    `);
    database.close();
    const store = new SqliteDurableStore(databasePath, clock);
    const check = new DatabaseSync(databasePath);
    expect(Object.values(check.prepare('PRAGMA user_version').get() as Record<string, unknown>)[0]).toBe(2);
    expect((await store.getEventsByProject('project-A')).map((item) => item.eventId)).toEqual(['old-event']);
    expect((await store.find('old-operation'))?.operationId).toBe('old-operation');
    expect(check.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'action_results'").get()).toBeTruthy();
    const newResult: StoredActionResult = {
      resultId: 'new-result', operationId: 'new-operation', actionId: 'new-action', status: 'ACCEPTED',
      currentStateRevision: 2, emittedAt: clock.now(),
    };
    const newEvent = event(2);
    const newMessage = { messageId: 'new-message', topic: 'domain.event', payload: newEvent, createdAt: clock.now() };
    await store.commitAction({
      dedupeRecord: {
        operationId: 'new-operation', actionId: 'new-action', intent: 'INITIALIZE_AI_TEAM', status: 'ACCEPTED',
        firstSeenAt: clock.now(), lastSeenAt: clock.now(), resultRef: newResult.resultId,
        projectId: 'project-A', requestFingerprint: 'new-fingerprint',
      },
      actionResult: newResult, event: newEvent, outboxMessages: [newMessage],
    });
    expect((await store.find('old-operation'))?.operationId).toBe('old-operation');
    expect(await store.find('new-operation')).toMatchObject({ operationId: 'new-operation', resultRef: 'new-result' });
    expect(await store.getByOperationId('new-operation')).toEqual(newResult);
    expect((await store.getEventsByProject('project-A')).map((item) => ({ sequence: item.sequence, stateRevision: item.stateRevision, payload: item.payload }))).toEqual([
      { sequence: 1, stateRevision: 1, payload: { state: 'STARTING' } },
      { sequence: 2, stateRevision: 2, payload: { state: 'CHECKING_READINESS' } },
    ]);
    expect((await store.fetchPending(10)).map((item) => item.messageId)).toEqual(['new-message']);
    check.close(); store.close();
  });

  it('fails closed for an unsupported schema version', async () => {
    const databasePath = await makeDatabase();
    const initial = new SqliteDurableStore(databasePath, clock);
    initial.close();
    const database = new DatabaseSync(databasePath);
    database.exec('PRAGMA user_version = 99');
    database.close();
    expect(() => new SqliteDurableStore(databasePath, clock)).toThrow(/Unsupported SQLite schema version/);
  });
});