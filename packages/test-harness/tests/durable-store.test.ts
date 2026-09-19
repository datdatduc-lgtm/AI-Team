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
  type ProjectState,
  type Snapshot,
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