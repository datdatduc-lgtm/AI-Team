export interface WorkerTelemetrySample {
  readonly workerId: string;
  readonly cpuUsage?: number;
  readonly memoryMb?: number;
  readonly contextLength?: number;
}

export interface TelemetryState {
  readonly telemetrySequence: number;
  readonly workers: Readonly<Record<string, WorkerTelemetrySample>>;
}

export interface DomainTelemetryEvent {
  readonly telemetrySequence: number;
  readonly sample: WorkerTelemetrySample;
}

export function createInitialTelemetryState(): TelemetryState {
  return { telemetrySequence: 0, workers: {} };
}

export function reduceTelemetry(state: TelemetryState, event: DomainTelemetryEvent): TelemetryState {
  if (event.telemetrySequence !== state.telemetrySequence + 1) return state;
  return {
    telemetrySequence: event.telemetrySequence,
    workers: { ...state.workers, [event.sample.workerId]: event.sample },
  };
}