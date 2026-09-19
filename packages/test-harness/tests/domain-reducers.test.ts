import { describe, expect, it } from 'vitest';
import {
  createInitialProjectState,
  createInitialTelemetryState,
  reduceAllProjectEvents,
  reduceProjectState,
  reduceTelemetry,
  type AgentState,
  type DomainEvent,
  type GoalState,
  type ProjectState,
  type WorkerState,
} from '@ai-team/core-domain';

const projectId = 'project-alpha';
const initial = createInitialProjectState(projectId);
const agent: AgentState = {
  agentId: 'agent-1', displayName: 'Agent One', agentType: 'WEB_AI', selectedForSession: true,
  assignedToGoal: true, healthStatus: 'HEALTHY', canContinueWithoutAgent: true,
  userActionRequired: false, statusSummary: 'Ready', recommendedActions: [],
};
const worker: WorkerState = {
  workerId: 'worker-1', displayName: 'Worker One', ownedByAgentId: 'agent-1',
  workState: 'IDLE', supportsPauseSafepoint: true, ownership: 'OWNED',
};
const goal: GoalState = {
  goalId: 'goal-1', goalState: 'INTAKE', summaryText: 'Ship P0.2', completedTaskCount: 0, totalTaskCount: 2,
};

function event<T extends DomainEvent['eventType']>(
  eventType: T,
  sequence: number,
  stateRevision: number,
  payload: Extract<DomainEvent, { eventType: T }>['payload'],
): Extract<DomainEvent, { eventType: T }> {
  return { eventId: `event-${sequence}`, eventType, projectId, sequence, stateRevision, payload } as Extract<DomainEvent, { eventType: T }>;
}

const replayEvents: readonly DomainEvent[] = [
  event('SESSION_STATE_CHANGED', 1, 1, { state: 'STARTING' }),
  event('SESSION_STATE_CHANGED', 2, 2, { state: 'CHECKING_READINESS' }),
  event('SESSION_STATE_CHANGED', 3, 3, { state: 'READY' }),
  event('GOAL_STATE_CHANGED', 4, 4, { goal }),
  event('GOAL_STATE_CHANGED', 5, 5, { goal: { ...goal, goalState: 'RESOLVING_CAPABILITIES' } }),
  event('GOAL_STATE_CHANGED', 6, 6, { goal: { ...goal, goalState: 'READY' } }),
  event('GOAL_STATE_CHANGED', 7, 7, { goal: { ...goal, goalState: 'RUNNING' } }),
  event('AGENT_STATE_CHANGED', 8, 8, { agent }),
  event('WORKER_STATE_CHANGED', 9, 9, { worker }),
  event('WORKER_STATE_CHANGED', 10, 10, { worker: { ...worker, workState: 'RUNNING' } }),
];

function apply(events: readonly DomainEvent[]): ProjectState {
  const result = reduceAllProjectEvents(initial, events);
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}

describe('P0.2 pure domain reducers', () => {
  it('creates an empty initial state', () => {
    expect(initial).toEqual({
      projectId, sequence: 0, stateRevision: 0, session: { state: 'OFF' },
      goals: {}, agents: {}, workers: {}, capabilities: {}, routes: {}, recoveries: {}, actionResults: {},
    });
  });

  it('accepts the valid deterministic replay sequence', () => {
    const state = apply(replayEvents);
    expect(state.sequence).toBe(10);
    expect(state.stateRevision).toBe(10);
    expect(state.session.state).toBe('READY');
    expect(state.goals['goal-1']?.goalState).toBe('RUNNING');
    expect(state.workers['worker-1']?.workState).toBe('RUNNING');
  });

  it('produces equal states for independent replays and equivalent reduction strategies', () => {
    const replayed = apply(replayEvents);
    const oneByOne = replayEvents.reduce((state, current) => {
      const result = reduceProjectState(state, current);
      if (!result.ok) throw new Error(result.error.message);
      return result.state;
    }, initial);
    expect(replayed).toEqual(oneByOne);
    expect(apply(replayEvents)).toEqual(replayed);
  });

  it('does not mutate the previous state after a successful reduce', () => {
    const before = structuredClone(initial);
    const result = reduceProjectState(initial, replayEvents[0]!);
    expect(result.ok).toBe(true);
    expect(initial).toEqual(before);
    expect(result.state).not.toBe(initial);
  });

  it.each([
    ['sequence gap', { sequence: 4, stateRevision: 1 }, 'SEQUENCE_MISMATCH'],
    ['duplicate sequence', { sequence: 0, stateRevision: 1 }, 'SEQUENCE_MISMATCH'],
    ['revision gap', { sequence: 1, stateRevision: 3 }, 'STATE_REVISION_MISMATCH'],
  ])('rejects %s', (_label, version, code) => {
    const result = reduceProjectState(initial, { ...replayEvents[0]!, ...version });
    expect(result).toMatchObject({ ok: false, state: initial, error: { code } });
  });

  it('rejects an event for another project', () => {
    const result = reduceProjectState(initial, { ...replayEvents[0]!, projectId: 'other' });
    expect(result).toMatchObject({ ok: false, state: initial, error: { code: 'PROJECT_ID_MISMATCH' } });
  });

  it.each([
    ['session', event('SESSION_STATE_CHANGED', 1, 1, { state: 'READY' })],
    ['goal', event('GOAL_STATE_CHANGED', 1, 1, { goal: { ...goal, goalState: 'COMPLETED' } })],
    ['worker', event('WORKER_STATE_CHANGED', 1, 1, { worker: { ...worker, workState: 'PAUSED' } })],
  ])('rejects invalid %s transition', (_label, invalidEvent) => {
    const result = reduceProjectState(initial, invalidEvent);
    expect(result).toMatchObject({ ok: false, state: initial, error: { code: 'INVALID_TRANSITION' } });
  });

  it('rejects terminal goal and worker transitions', () => {
    const completed = apply(replayEvents.slice(0, 7));
    const terminalGoal = reduceProjectState(completed, event('GOAL_STATE_CHANGED', 8, 8, {
      goal: { ...completed.goals['goal-1']!, goalState: 'COMPLETED' },
    }));
    expect(terminalGoal.ok).toBe(true);
    if (!terminalGoal.ok) return;
    expect(reduceProjectState(terminalGoal.state, event('GOAL_STATE_CHANGED', 9, 9, {
      goal: { ...terminalGoal.state.goals['goal-1']!, goalState: 'RUNNING' },
    }))).toMatchObject({ ok: false, error: { code: 'INVALID_TRANSITION' } });

    const terminated = apply([
      event('WORKER_STATE_CHANGED', 1, 1, { worker }),
      event('WORKER_STATE_CHANGED', 2, 2, { worker: { ...worker, workState: 'TERMINATED' } }),
    ]);
    expect(reduceProjectState(terminated, event('WORKER_STATE_CHANGED', 3, 3, {
      worker: { ...terminated.workers['worker-1']!, workState: 'RUNNING' },
    }))).toMatchObject({ ok: false, error: { code: 'INVALID_TRANSITION' } });
  });

  it('rejects invalid goal counts', () => {
    const result = reduceProjectState(initial, event('GOAL_STATE_CHANGED', 1, 1, {
      goal: { ...goal, completedTaskCount: 3 },
    }));
    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_DOMAIN_VALUE' } });
  });

  it('allows same-state goal updates while preserving invariants', () => {
    const running = apply([
      event('GOAL_STATE_CHANGED', 1, 1, { goal }),
      event('GOAL_STATE_CHANGED', 2, 2, { goal: { ...goal, goalState: 'RESOLVING_CAPABILITIES' } }),
      event('GOAL_STATE_CHANGED', 3, 3, { goal: { ...goal, goalState: 'READY' } }),
      event('GOAL_STATE_CHANGED', 4, 4, { goal: { ...goal, goalState: 'RUNNING' } }),
    ]);
    const result = reduceProjectState(running, event('GOAL_STATE_CHANGED', 5, 5, {
      goal: { ...running.goals['goal-1']!, completedTaskCount: 1, summaryText: 'Half complete' },
    }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.goals['goal-1']).toMatchObject({ goalState: 'RUNNING', completedTaskCount: 1, summaryText: 'Half complete' });
  });

  it('allows same-state worker updates while preserving semantic state', () => {
    const running = apply([
      event('WORKER_STATE_CHANGED', 1, 1, { worker }),
      event('WORKER_STATE_CHANGED', 2, 2, { worker: { ...worker, workState: 'RUNNING', currentTaskSummary: 'task A' } }),
    ]);
    const result = reduceProjectState(running, event('WORKER_STATE_CHANGED', 3, 3, {
      worker: { ...running.workers['worker-1']!, currentTaskSummary: 'task B' },
    }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.workers['worker-1']).toMatchObject({ workState: 'RUNNING', currentTaskSummary: 'task B' });
  });

  it('rejects same-state goal updates with invalid counts', () => {
    const running = apply([
      event('GOAL_STATE_CHANGED', 1, 1, { goal }),
      event('GOAL_STATE_CHANGED', 2, 2, { goal: { ...goal, goalState: 'RESOLVING_CAPABILITIES' } }),
      event('GOAL_STATE_CHANGED', 3, 3, { goal: { ...goal, goalState: 'READY' } }),
      event('GOAL_STATE_CHANGED', 4, 4, { goal: { ...goal, goalState: 'RUNNING' } }),
    ]);
    expect(reduceProjectState(running, event('GOAL_STATE_CHANGED', 5, 5, {
      goal: { ...running.goals['goal-1']!, completedTaskCount: 3 },
    }))).toMatchObject({ ok: false, state: running, error: { code: 'INVALID_DOMAIN_VALUE' } });
  });

  it('keeps session unchanged when a goal event is reduced', () => {
    const state = apply([event('SESSION_STATE_CHANGED', 1, 1, { state: 'STARTING' })]);
    const result = reduceProjectState(state, event('GOAL_STATE_CHANGED', 2, 2, { goal }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.session).toEqual(state.session);
  });

  it('keeps goals unchanged when a session event is reduced', () => {
    const state = apply([event('GOAL_STATE_CHANGED', 1, 1, { goal })]);
    const result = reduceProjectState(state, event('SESSION_STATE_CHANGED', 2, 2, { state: 'STARTING' }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.goals).toEqual(state.goals);
  });

  it('keeps workers unchanged when an agent event is reduced', () => {
    const state = apply([event('WORKER_STATE_CHANGED', 1, 1, { worker })]);
    const result = reduceProjectState(state, event('AGENT_STATE_CHANGED', 2, 2, { agent }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.workers).toEqual(state.workers);
  });

  it('keeps agents unchanged when a worker event is reduced', () => {
    const state = apply([event('AGENT_STATE_CHANGED', 1, 1, { agent })]);
    const result = reduceProjectState(state, event('WORKER_STATE_CHANGED', 2, 2, { worker }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.agents).toEqual(state.agents);
  });

  it('keeps the goal unchanged when a capability event is reduced', () => {
    const state = apply([event('GOAL_STATE_CHANGED', 1, 1, { goal })]);
    const result = reduceProjectState(state, event('CAPABILITY_STATE_CHANGED', 2, 2, {
      capability: { requirementId: 'req-1', capabilityName: 'model', category: 'MODEL', requiredForGoal: true,
        status: 'AVAILABLE', alternatives: [], recommendedActions: [] },
    }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.goals).toEqual(state.goals);
  });

  it('keeps the agent unchanged when a route event is reduced', () => {
    const state = apply([event('AGENT_STATE_CHANGED', 1, 1, { agent })]);
    const result = reduceProjectState(state, event('ROUTE_STATE_CHANGED', 2, 2, {
      route: { routeId: 'route-1', targetAgentId: agent.agentId, semanticState: 'READY', statusMessage: 'Ready' },
    }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.agents).toEqual(state.agents);
  });

  it('materializes recovery without changing its target aggregate', () => {
    const state = apply([event('WORKER_STATE_CHANGED', 1, 1, { worker })]);
    const result = reduceProjectState(state, event('SYSTEM_RECOVERY_TRIGGERED', 2, 2, {
      recovery: { target: { type: 'WORKER', id: worker.workerId }, whatHappened: 'stuck',
        whatAiTeamIsDoing: 'recovering', whatUserShouldDo: 'wait', recoveryStatus: 'RECOVERING', recommendedActions: [] },
    }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.workers).toEqual(state.workers);
    expect(result.state.recoveries['WORKER:worker-1']?.recoveryStatus).toBe('RECOVERING');
  });

  it('isolates telemetry from semantic project state', () => {
    const semantic = apply([event('WORKER_STATE_CHANGED', 1, 1, { worker })]);
    const telemetry = reduceTelemetry(createInitialTelemetryState(), {
      telemetrySequence: 1, sample: { workerId: worker.workerId, cpuUsage: 42, memoryMb: 100 },
    });
    expect(telemetry.telemetrySequence).toBe(1);
    expect(telemetry.workers['worker-1']?.cpuUsage).toBe(42);
    expect(semantic.sequence).toBe(1);
    expect(semantic.stateRevision).toBe(1);
    expect(semantic.workers['worker-1']).toEqual(worker);
  });
});