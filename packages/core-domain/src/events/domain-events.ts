import type {
  ActionResultState,
  AgentState,
  CapabilityState,
  GoalState,
  RecoveryState,
  RouteState,
  SessionStateName,
  WorkerState,
} from '../state/domain-state.js';

export type DomainEventType =
  | 'SESSION_STATE_CHANGED'
  | 'GOAL_STATE_CHANGED'
  | 'AGENT_STATE_CHANGED'
  | 'WORKER_STATE_CHANGED'
  | 'CAPABILITY_STATE_CHANGED'
  | 'ROUTE_STATE_CHANGED'
  | 'SYSTEM_RECOVERY_TRIGGERED'
  | 'ACTION_RESULT_EMITTED';

export interface DomainEventEnvelope<TType extends DomainEventType, TPayload> {
  readonly eventId: string;
  readonly eventType: TType;
  readonly projectId: string;
  readonly sequence: number;
  readonly stateRevision: number;
  readonly payload: TPayload;
}

export type SessionStateChangedEvent = DomainEventEnvelope<
  'SESSION_STATE_CHANGED',
  { readonly state: SessionStateName }
>;
export type GoalStateChangedEvent = DomainEventEnvelope<'GOAL_STATE_CHANGED', { readonly goal: GoalState }>;
export type AgentStateChangedEvent = DomainEventEnvelope<'AGENT_STATE_CHANGED', { readonly agent: AgentState }>;
export type WorkerStateChangedEvent = DomainEventEnvelope<'WORKER_STATE_CHANGED', { readonly worker: WorkerState }>;
export type CapabilityStateChangedEvent = DomainEventEnvelope<
  'CAPABILITY_STATE_CHANGED',
  { readonly capability: CapabilityState }
>;
export type RouteStateChangedEvent = DomainEventEnvelope<'ROUTE_STATE_CHANGED', { readonly route: RouteState }>;
export type SystemRecoveryTriggeredEvent = DomainEventEnvelope<
  'SYSTEM_RECOVERY_TRIGGERED',
  { readonly recovery: RecoveryState }
>;
export type ActionResultEmittedEvent = DomainEventEnvelope<
  'ACTION_RESULT_EMITTED',
  { readonly result: ActionResultState }
>;

export type DomainEvent =
  | SessionStateChangedEvent
  | GoalStateChangedEvent
  | AgentStateChangedEvent
  | WorkerStateChangedEvent
  | CapabilityStateChangedEvent
  | RouteStateChangedEvent
  | SystemRecoveryTriggeredEvent
  | ActionResultEmittedEvent;