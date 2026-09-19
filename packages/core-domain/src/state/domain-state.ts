export type SessionStateName =
  | 'OFF'
  | 'STARTING'
  | 'CHECKING_READINESS'
  | 'READY'
  | 'READY_DEGRADED'
  | 'BLOCKED'
  | 'ENDING';

export type GoalStateName =
  | 'INTAKE'
  | 'RESOLVING_CAPABILITIES'
  | 'READY'
  | 'RUNNING'
  | 'PAUSING'
  | 'PAUSED'
  | 'RECOVERING'
  | 'WAITING_FOR_USER'
  | 'BLOCKED'
  | 'FAILED'
  | 'COMPLETED';

export type AgentType = 'WEB_AI' | 'MANAGED_LOCAL_AGENT';
export type AgentHealthStatus = 'HEALTHY' | 'DEGRADED' | 'DISCONNECTED' | 'OFF';
export type DomainWorkerWorkState =
  | 'IDLE'
  | 'RUNNING'
  | 'PAUSING_SAFEPOINT'
  | 'PAUSED'
  | 'RECOVERING'
  | 'STUCK'
  | 'TERMINATED';
export type DomainWorkerOwnership = 'OWNED' | 'BORROWED' | 'FOREIGN';
export type CapabilityCategory = 'SKILL' | 'PLUGIN_MCP' | 'APP_CONNECTION' | 'MODEL';
export type CapabilityStatus = 'AVAILABLE' | 'DISABLED' | 'UNCONFIGURED' | 'MISSING' | 'INCOMPATIBLE';
export type RouteSemanticState =
  | 'CONFIGURED'
  | 'VERIFYING'
  | 'READY'
  | 'AUTH_REQUIRED'
  | 'WRONG_CONVERSATION'
  | 'MISSING'
  | 'BROKEN';
export type RecoveryTargetType = 'WORKER' | 'AGENT' | 'ROUTE' | 'CAPABILITY' | 'GOAL';
export type RecoveryStatus = 'RECOVERING' | 'WAITING_FOR_USER' | 'BLOCKED' | 'FAILED';
export type ActionResultStatus = 'ACCEPTED' | 'REJECTED' | 'REQUIRES_APPROVAL' | 'CONFLICT' | 'UNSUPPORTED';

export interface SessionState {
  readonly state: SessionStateName;
}

export interface GoalState {
  readonly goalId: string;
  readonly goalState: GoalStateName;
  readonly summaryText: string;
  readonly completedTaskCount: number;
  readonly totalTaskCount: number;
}

export interface AgentState {
  readonly agentId: string;
  readonly displayName: string;
  readonly agentType: AgentType;
  readonly selectedForSession: boolean;
  readonly assignedToGoal: boolean;
  readonly sessionRole?: string;
  readonly goalRole?: string;
  readonly healthStatus: AgentHealthStatus;
  readonly canContinueWithoutAgent: boolean;
  readonly userActionRequired: boolean;
  readonly statusSummary: string;
  readonly recommendedActions: readonly string[];
}

export interface WorkerState {
  readonly workerId: string;
  readonly displayName: string;
  readonly ownedByAgentId: string;
  readonly currentTaskSummary?: string;
  readonly workState: DomainWorkerWorkState;
  readonly supportsPauseSafepoint: boolean;
  readonly ownership: DomainWorkerOwnership;
}

export interface CapabilityState {
  readonly requirementId: string;
  readonly capabilityName: string;
  readonly category: CapabilityCategory;
  readonly requiredForGoal: boolean;
  readonly status: CapabilityStatus;
  readonly selectedProviderId?: string;
  readonly alternatives: readonly string[];
  readonly recommendedActions: readonly string[];
}

export interface RouteState {
  readonly routeId: string;
  readonly targetAgentId: string;
  readonly semanticState: RouteSemanticState;
  readonly statusMessage: string;
  readonly capturedTargetName?: string;
}

export interface RecoveryTarget {
  readonly type: RecoveryTargetType;
  readonly id: string;
}

export interface RecoveryState {
  readonly target: RecoveryTarget;
  readonly whatHappened: string;
  readonly whatAiTeamIsDoing: string;
  readonly whatUserShouldDo: string;
  readonly recoveryStatus: RecoveryStatus;
  readonly attemptIndex?: number;
  readonly attemptLimit?: number;
  readonly recommendedActions: readonly string[];
}

export interface ActionResultState {
  readonly actionId: string;
  readonly operationId: string;
  readonly status: ActionResultStatus;
  readonly currentStateRevision: number;
  readonly message?: string;
  readonly rejectionReason?: string;
}

export interface ProjectState {
  readonly projectId: string;
  readonly sequence: number;
  readonly stateRevision: number;
  readonly session: SessionState;
  readonly goals: Readonly<Record<string, GoalState>>;
  readonly agents: Readonly<Record<string, AgentState>>;
  readonly workers: Readonly<Record<string, WorkerState>>;
  readonly capabilities: Readonly<Record<string, CapabilityState>>;
  readonly routes: Readonly<Record<string, RouteState>>;
  readonly recoveries: Readonly<Record<string, RecoveryState>>;
  readonly actionResults: Readonly<Record<string, ActionResultState>>;
}

export function createInitialProjectState(projectId: string): ProjectState {
  return {
    projectId,
    sequence: 0,
    stateRevision: 0,
    session: { state: 'OFF' },
    goals: {},
    agents: {},
    workers: {},
    capabilities: {},
    routes: {},
    recoveries: {},
    actionResults: {},
  };
}