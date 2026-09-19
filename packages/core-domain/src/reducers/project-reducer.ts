import type { DomainEvent } from '../events/domain-events.js';
import {
  GOAL_TRANSITIONS,
  isAllowedTransition,
  SESSION_TRANSITIONS,
  WORKER_TRANSITIONS,
} from './state-machines.js';
import type { GoalState, ProjectState } from '../state/domain-state.js';

export type DomainReduceErrorCode =
  | 'PROJECT_ID_MISMATCH'
  | 'SEQUENCE_MISMATCH'
  | 'STATE_REVISION_MISMATCH'
  | 'INVALID_TRANSITION'
  | 'INVALID_DOMAIN_VALUE';

export interface DomainReduceError {
  readonly code: DomainReduceErrorCode;
  readonly message: string;
}

export type ReduceResult =
  | { readonly ok: true; readonly state: ProjectState }
  | { readonly ok: false; readonly state: ProjectState; readonly error: DomainReduceError };

function reject(state: ProjectState, code: DomainReduceErrorCode, message: string): ReduceResult {
  return { ok: false, state, error: { code, message } };
}

function validText(value: string): boolean {
  return value.trim().length > 0;
}

function validGoal(goal: GoalState): boolean {
  return validText(goal.goalId)
    && Number.isInteger(goal.completedTaskCount)
    && Number.isInteger(goal.totalTaskCount)
    && goal.completedTaskCount >= 0
    && goal.totalTaskCount >= 0
    && goal.completedTaskCount <= goal.totalTaskCount;
}

export function reduceProjectState(state: ProjectState, event: DomainEvent): ReduceResult {
  if (event.projectId !== state.projectId) {
    return reject(state, 'PROJECT_ID_MISMATCH', 'Event project does not match project state.');
  }
  if (event.sequence !== state.sequence + 1) {
    return reject(state, 'SEQUENCE_MISMATCH', 'Event sequence must be exactly one greater than state sequence.');
  }
  if (event.stateRevision !== state.stateRevision + 1) {
    return reject(state, 'STATE_REVISION_MISMATCH', 'Event stateRevision must be exactly one greater than state revision.');
  }

  const nextVersion = { sequence: event.sequence, stateRevision: event.stateRevision };
  switch (event.eventType) {
    case 'SESSION_STATE_CHANGED': {
      if (!isAllowedTransition(SESSION_TRANSITIONS, state.session.state, event.payload.state)) {
        return reject(state, 'INVALID_TRANSITION', `Session cannot transition from ${state.session.state} to ${event.payload.state}.`);
      }
      return { ok: true, state: { ...state, ...nextVersion, session: { state: event.payload.state } } };
    }
    case 'GOAL_STATE_CHANGED': {
      const goal = event.payload.goal;
      if (!validGoal(goal)) return reject(state, 'INVALID_DOMAIN_VALUE', 'Goal task counts or goalId are invalid.');
      const previous = state.goals[goal.goalId];
      if (previous && previous.goalState !== goal.goalState
        && !isAllowedTransition(GOAL_TRANSITIONS, previous.goalState, goal.goalState)) {
        return reject(state, 'INVALID_TRANSITION', `Goal cannot transition from ${previous.goalState} to ${goal.goalState}.`);
      }
      if (!previous && goal.goalState !== 'INTAKE') {
        return reject(state, 'INVALID_TRANSITION', 'A new goal must begin in INTAKE.');
      }
      return { ok: true, state: { ...state, ...nextVersion, goals: { ...state.goals, [goal.goalId]: goal } } };
    }
    case 'AGENT_STATE_CHANGED': {
      const agent = event.payload.agent;
      if (!validText(agent.agentId) || !validText(agent.displayName)) {
        return reject(state, 'INVALID_DOMAIN_VALUE', 'Agent identifiers and display name are required.');
      }
      return { ok: true, state: { ...state, ...nextVersion, agents: { ...state.agents, [agent.agentId]: agent } } };
    }
    case 'WORKER_STATE_CHANGED': {
      const worker = event.payload.worker;
      const previous = state.workers[worker.workerId];
      if (!validText(worker.workerId) || !validText(worker.displayName) || !validText(worker.ownedByAgentId)) {
        return reject(state, 'INVALID_DOMAIN_VALUE', 'Worker identifiers and ownership are required.');
      }
      if (previous && previous.workState !== worker.workState
        && !isAllowedTransition(WORKER_TRANSITIONS, previous.workState, worker.workState)) {
        return reject(state, 'INVALID_TRANSITION', `Worker cannot transition from ${previous.workState} to ${worker.workState}.`);
      }
      if (!previous && worker.workState !== 'IDLE') {
        return reject(state, 'INVALID_TRANSITION', 'A new worker must begin in IDLE.');
      }
      return { ok: true, state: { ...state, ...nextVersion, workers: { ...state.workers, [worker.workerId]: worker } } };
    }
    case 'CAPABILITY_STATE_CHANGED': {
      const capability = event.payload.capability;
      if (!validText(capability.requirementId) || !validText(capability.capabilityName)) {
        return reject(state, 'INVALID_DOMAIN_VALUE', 'Capability identifiers and name are required.');
      }
      return {
        ok: true,
        state: { ...state, ...nextVersion, capabilities: { ...state.capabilities, [capability.requirementId]: capability } },
      };
    }
    case 'ROUTE_STATE_CHANGED': {
      const route = event.payload.route;
      if (!validText(route.routeId) || !validText(route.targetAgentId)) {
        return reject(state, 'INVALID_DOMAIN_VALUE', 'Route identifiers and target agent are required.');
      }
      return { ok: true, state: { ...state, ...nextVersion, routes: { ...state.routes, [route.routeId]: route } } };
    }
    case 'SYSTEM_RECOVERY_TRIGGERED': {
      const recovery = event.payload.recovery;
      if (!validText(recovery.target.id)) {
        return reject(state, 'INVALID_DOMAIN_VALUE', 'Recovery target id is required.');
      }
      const key = `${recovery.target.type}:${recovery.target.id}`;
      return { ok: true, state: { ...state, ...nextVersion, recoveries: { ...state.recoveries, [key]: recovery } } };
    }
    case 'ACTION_RESULT_EMITTED': {
      const result = event.payload.result;
      if (!validText(result.operationId) || !validText(result.actionId)) {
        return reject(state, 'INVALID_DOMAIN_VALUE', 'Action and operation identifiers are required.');
      }
      return {
        ok: true,
        state: { ...state, ...nextVersion, actionResults: { ...state.actionResults, [result.operationId]: result } },
      };
    }
  }
}

export function reduceAllProjectEvents(initial: ProjectState, events: readonly DomainEvent[]): ReduceResult {
  let result: ReduceResult = { ok: true, state: initial };
  for (const event of events) {
    result = reduceProjectState(result.state, event);
    if (!result.ok) return result;
  }
  return result;
}