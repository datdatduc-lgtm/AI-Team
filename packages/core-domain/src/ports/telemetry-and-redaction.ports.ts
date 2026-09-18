export interface TelemetryEvent {
  readonly name: string;
  readonly timestamp: string;
  readonly attributes: Readonly<Record<string, string | number | boolean>>;
}

export interface TelemetryPort {
  emit(event: TelemetryEvent): void;
}

export interface RedactionPort {
  redactText(raw: string): string;
  redactObject<T extends object>(obj: T): T;
}
