import type { DomainWorkerWorkState, GoalStateName, SessionStateName } from '../state/domain-state.js';

const transitions = <T extends string>(entries: Readonly<Record<T, readonly T[]>>) => entries;

export const SESSION_TRANSITIONS = transitions<SessionStateName>({
  OFF: ['STARTING'],
  STARTING: ['CHECKING_READINESS', 'BLOCKED', 'ENDING'],
  CHECKING_READINESS: ['READY', 'READY_DEGRADED', 'BLOCKED', 'ENDING'],
  READY: ['CHECKING_READINESS', 'READY_DEGRADED', 'BLOCKED', 'ENDING'],
  READY_DEGRADED: ['CHECKING_READINESS', 'READY', 'BLOCKED', 'ENDING'],
  BLOCKED: ['CHECKING_READINESS', 'ENDING'],
  ENDING: ['OFF'],
});

export const GOAL_TRANSITIONS = transitions<GoalStateName>({
  INTAKE: ['RESOLVING_CAPABILITIES', 'BLOCKED', 'FAILED'],
  RESOLVING_CAPABILITIES: ['READY', 'WAITING_FOR_USER', 'BLOCKED', 'FAILED'],
  READY: ['RUNNING', 'BLOCKED', 'FAILED'],
  RUNNING: ['PAUSING', 'RECOVERING', 'WAITING_FOR_USER', 'BLOCKED', 'FAILED', 'COMPLETED'],
  PAUSING: ['PAUSED', 'RECOVERING', 'FAILED'],
  PAUSED: ['RUNNING', 'RECOVERING', 'BLOCKED', 'FAILED'],
  RECOVERING: ['RUNNING', 'PAUSED', 'WAITING_FOR_USER', 'BLOCKED', 'FAILED'],
  WAITING_FOR_USER: ['RESOLVING_CAPABILITIES', 'READY', 'RUNNING', 'PAUSED', 'BLOCKED', 'FAILED'],
  BLOCKED: ['RESOLVING_CAPABILITIES', 'READY', 'RUNNING', 'WAITING_FOR_USER', 'FAILED'],
  FAILED: [],
  COMPLETED: [],
});

export const WORKER_TRANSITIONS = transitions<DomainWorkerWorkState>({
  IDLE: ['RUNNING', 'TERMINATED'],
  RUNNING: ['PAUSING_SAFEPOINT', 'RECOVERING', 'STUCK', 'TERMINATED'],
  PAUSING_SAFEPOINT: ['PAUSED', 'RECOVERING', 'STUCK'],
  PAUSED: ['RUNNING', 'RECOVERING', 'TERMINATED'],
  RECOVERING: ['RUNNING', 'PAUSED', 'STUCK', 'TERMINATED'],
  STUCK: ['RECOVERING', 'TERMINATED'],
  TERMINATED: [],
});

export function isAllowedTransition<T extends string>(
  table: Readonly<Record<T, readonly T[]>>,
  from: T,
  to: T,
): boolean {
  return table[from]?.includes(to) ?? false;
}