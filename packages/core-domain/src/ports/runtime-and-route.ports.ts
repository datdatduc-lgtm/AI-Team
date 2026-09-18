export type WorkerWorkState = 'IDLE' | 'WORKING' | 'PAUSED' | 'STOPPED' | 'DRAINING';
export type WorkerOwnership = 'OWNED' | 'BORROWED' | 'FOREIGN';

export interface WorkerDescriptor {
  readonly workerId: string;
  readonly ownedByAgentId: string;
  readonly workState: WorkerWorkState;
  readonly supportsPauseSafepoint: boolean;
  readonly ownership: WorkerOwnership;
}

export interface WorkerRuntimePort {
  listWorkers(): Promise<readonly WorkerDescriptor[]>;
  getWorker(workerId: string): Promise<WorkerDescriptor | null>;
}

export interface FocusedRouteState {
  readonly routeId: string;
  readonly routeName: string;
  readonly isFocused: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface RouteAdapterPort {
  getCurrentFocusedRoute(): Promise<FocusedRouteState | null>;
}
