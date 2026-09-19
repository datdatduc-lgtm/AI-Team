import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, afterEach } from 'vitest';
import { ActionEngine, actionFingerprint, type ActionPlan, type ActionPlannerPort } from '@ai-team/core-application';
import type { Clock, IdGenerator, ProjectState } from '@ai-team/core-domain';
import { SqliteDurableStore } from '@ai-team/core-infrastructure';
import type { UIActionEnvelope } from '@ai-team/ui-contract';

const paths: string[] = [];
const stores: SqliteDurableStore[] = [];
let idSequence = 0;
const clock: Clock = { now: () => '2026-09-19T00:00:00.000Z' };
function ids(): IdGenerator { return { next: () => `id-${++idSequence}` }; }
async function databasePath(): Promise<string> { const dir = await mkdtemp(join(tmpdir(), 'ai-team-p0-4-')); paths.push(dir); return join(dir, 'actions.sqlite'); }
afterEach(async () => { for (const store of stores.splice(0)) { try { store.close(); } catch { /* already closed by restart test */ } } for (const path of paths.splice(0)) await rm(path, { recursive: true, force: true }); });

const action = (operationId = 'op-1', expectedStateRevision = 0, parameters: Record<string, unknown> = {}): UIActionEnvelope => ({
  schemaVersion: '1.0.0', actionId: 'action-1', operationId, intent: 'INITIALIZE_AI_TEAM', projectId: 'project-A',
  sessionId: 'session-A', goalId: null, expectedStateRevision, target: null, parameters,
});

class FakePlanner implements ActionPlannerPort {
  public calls = 0;
  public constructor(private readonly planResult: ActionPlan) {}
  public plan(_action: UIActionEnvelope, _state: ProjectState): ActionPlan { this.calls += 1; return this.planResult; }
}

function acceptedPlanner(): FakePlanner {
  return new FakePlanner({ kind: 'ACCEPT', eventType: 'SESSION_STATE_CHANGED', payload: { state: 'STARTING' } });
}

function engine(store: SqliteDurableStore, planner: FakePlanner): ActionEngine {
  stores.push(store);
  return new ActionEngine(clock, ids(), store, store, store, store, planner);
}

describe('P0.4 durable idempotent action engine', () => {
  it('commits accepted action once and returns the stored result on retry', async () => {
    const store = new SqliteDurableStore(await databasePath(), clock); const planner = acceptedPlanner(); const service = engine(store, planner);
    const first = await service.dispatch(action()); const second = await service.dispatch(action());
    expect(first).toEqual(second); expect(first.status).toBe('ACCEPTED'); expect(planner.calls).toBe(1);
    expect((await store.getEventsByProject('project-A')).length).toBe(1); expect((await store.fetchPending(10)).length).toBe(1);
  });

  it('returns original result after state advances and rejects same id with a different fingerprint', async () => {
    const store = new SqliteDurableStore(await databasePath(), clock); const planner = acceptedPlanner(); const service = engine(store, planner);
    const first = await service.dispatch(action());
    const nextPlanner = new FakePlanner({ kind: 'ACCEPT', eventType: 'SESSION_STATE_CHANGED', payload: { state: 'CHECKING_READINESS' } });
    await new ActionEngine(clock, ids(), store, store, store, store, nextPlanner).dispatch(action('op-2', 1));
    expect(await service.dispatch(action())).toEqual(first); expect(planner.calls).toBe(1);
    const changed = await service.dispatch(action('op-1', 0, { changed: true })); expect(changed.status).toBe('CONFLICT');
    expect((await store.getEventsByProject('project-A')).length).toBe(2);
  });

  it('persists stale revision conflict without event or outbox', async () => {
    const store = new SqliteDurableStore(await databasePath(), clock); const planner = acceptedPlanner(); const service = engine(store, planner);
    await service.dispatch(action('op-1')); const conflict = await service.dispatch(action('op-2', 0));
    expect(conflict.status).toBe('CONFLICT'); expect(planner.calls).toBe(1); expect((await store.getEventsByProject('project-A')).length).toBe(1);
    expect(await service.dispatch(action('op-2', 0))).toEqual(conflict);
  });

  it('uses reducer authority and durably rejects invalid planned transitions', async () => {
    const store = new SqliteDurableStore(await databasePath(), clock); const planner = new FakePlanner({ kind: 'ACCEPT', eventType: 'SESSION_STATE_CHANGED', payload: { state: 'READY' } });
    const result = await engine(store, planner).dispatch(action()); expect(result.status).toBe('REJECTED'); expect((await store.getEventsByProject('project-A')).length).toBe(0); expect((await store.fetchPending(10)).length).toBe(0);
  });

  it('handles concurrent same-operation dispatch with one semantic effect', async () => {
    const store = new SqliteDurableStore(await databasePath(), clock); const planner = acceptedPlanner(); const service = engine(store, planner);
    const results = await Promise.all([service.dispatch(action()), service.dispatch(action())]);
    expect(results[0]).toEqual(results[1]); expect((await store.getEventsByProject('project-A')).length).toBe(1); expect(planner.calls).toBe(1);
  });

  it('returns a transient conflict for concurrent same-operation different requests', async () => {
    const store = new SqliteDurableStore(await databasePath(), clock); const planner = acceptedPlanner(); const service = engine(store, planner);
    const results = await Promise.all([service.dispatch(action('op-1', 0, { x: 1 })), service.dispatch(action('op-1', 0, { x: 2 }))]);
    expect(results.filter((result) => result.status === 'ACCEPTED')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'CONFLICT')).toHaveLength(1);
    expect(results.find((result) => result.status === 'CONFLICT')?.rejectionReason).toBe('OPERATION_ID_REUSED');
    expect(planner.calls).toBe(1); expect((await store.getEventsByProject('project-A')).length).toBe(1);
  });

  it('arbitrates the same operation across two engines without duplicate effects', async () => {
    const database = await databasePath(); const store = new SqliteDurableStore(database, clock); const storeB = new SqliteDurableStore(database, clock); stores.push(storeB);
    const plannerA = acceptedPlanner(); const plannerB = acceptedPlanner(); const serviceA = engine(store, plannerA); const serviceB = new ActionEngine(clock, ids(), storeB, storeB, storeB, storeB, plannerB);
    expect(actionFingerprint(action('op-1', 0, { x: 1 }))).not.toBe(actionFingerprint(action('op-1', 0, { x: 2 })));
    const results = await Promise.all([serviceA.dispatch(action()), serviceB.dispatch(action())]);
    expect(results[0]).toEqual(results[1]); expect(results[0].status).toBe('ACCEPTED');
    expect(plannerA.calls + plannerB.calls).toBe(2); expect((await store.getEventsByProject('project-A')).length).toBe(1);
    expect((await store.fetchPending(10)).filter((item) => item.topic === 'domain.event')).toHaveLength(1);
  });

  it('returns a conflict across engines for a different request with the same operation id', async () => {
    const database = await databasePath(); const store = new SqliteDurableStore(database, clock); const storeB = new SqliteDurableStore(database, clock); stores.push(storeB);
    const plannerA = acceptedPlanner(); const plannerB = acceptedPlanner(); const serviceA = engine(store, plannerA); const serviceB = new ActionEngine(clock, ids(), storeB, storeB, storeB, storeB, plannerB);
    const winner = await serviceA.dispatch(action('op-1', 0, { x: 1 }));
    const loser = await serviceB.dispatch(action('op-1', 0, { x: 2 }));
    expect(winner.status).toBe('ACCEPTED'); expect(loser.status).toBe('CONFLICT');
    expect((await store.getEventsByProject('project-A')).length).toBe(1); expect((await store.fetchPending(10)).filter((item) => item.topic === 'domain.event')).toHaveLength(1);
    expect(await store.getByOperationId('op-1')).toBeTruthy();
  });

  it('rejects concurrent different operations against the same revision', async () => {
    const store = new SqliteDurableStore(await databasePath(), clock); const planner = acceptedPlanner();
    const serviceA = engine(store, planner); const serviceB = new ActionEngine(clock, ids(), store, store, store, store, planner);
    const results = await Promise.all([serviceA.dispatch(action('op-A')), serviceB.dispatch(action('op-B'))]);
    expect(results.filter((result) => result.status === 'ACCEPTED')).toHaveLength(1); expect(results.filter((result) => result.status === 'CONFLICT')).toHaveLength(1);
    expect((await store.getEventsByProject('project-A')).map((event) => event.sequence)).toEqual([1]);
    expect((await store.fetchPending(10)).filter((item) => item.topic === 'domain.event')).toHaveLength(1);
  });

  it('replays the durable result after engine restart without planning again', async () => {
    const database = await databasePath(); const firstPlanner = acceptedPlanner(); const firstStore = new SqliteDurableStore(database, clock); stores.push(firstStore);
    const original = await engine(firstStore, firstPlanner).dispatch(action()); stores.splice(stores.indexOf(firstStore), 1); firstStore.close();
    const secondPlanner = acceptedPlanner(); const secondStore = new SqliteDurableStore(database, clock); stores.push(secondStore);
    expect(await new ActionEngine(clock, ids(), secondStore, secondStore, secondStore, secondStore, secondPlanner).dispatch(action())).toEqual(original);
    expect(secondPlanner.calls).toBe(0); expect((await secondStore.getEventsByProject('project-A')).length).toBe(1); expect((await secondStore.fetchPending(10)).length).toBe(1);
  });

  it('isolates project identity and canonicalizes request fingerprints', async () => {
    const store = new SqliteDurableStore(await databasePath(), clock); const service = engine(store, acceptedPlanner());
    await service.dispatch(action());
    const otherProject = { ...action(), projectId: 'project-B' };
    expect((await service.dispatch(otherProject)).status).toBe('CONFLICT'); expect((await store.getByOperationId('op-1'))?.operationId).toBe('op-1');
    expect(actionFingerprint({ ...action(), parameters: { b: 2, a: { d: 4, c: 3 } } })).toBe(actionFingerprint({ ...action(), parameters: { a: { c: 3, d: 4 }, b: 2 } }));
    expect(actionFingerprint({ ...action(), parameters: [1, 2] as unknown as Record<string, unknown> })).not.toBe(actionFingerprint({ ...action(), parameters: [2, 1] as unknown as Record<string, unknown> }));
  });

  it('durably rejects malformed actions only when an operation id is available', async () => {
    const store = new SqliteDurableStore(await databasePath(), clock); const service = engine(store, acceptedPlanner());
    const malformed = { ...action(), intent: 'INVALID' } as unknown as UIActionEnvelope;
    const rejected = await service.dispatch(malformed); expect(rejected.status).toBe('REJECTED'); expect(rejected.rejectionReason).toBe('VALIDATION_ERROR');
    expect(await service.dispatch(malformed)).toEqual(rejected); expect(await store.getByOperationId('op-1')).toBeTruthy();
    expect((await store.getEventsByProject('project-A')).length).toBe(0); expect((await store.fetchPending(10)).length).toBe(0);
    const withoutOperation = { ...malformed, operationId: undefined } as unknown as UIActionEnvelope;
    expect((await service.dispatch(withoutOperation)).status).toBe('REJECTED'); expect(await store.getByOperationId('')).toBeNull();
  });
});