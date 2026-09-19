import type {
  Clock,
  IdGenerator,
  TelemetryPort,
  TelemetryEvent,
  RedactionPort,
} from '@ai-team/core-domain';

/**
 * System clock adapter for production environment
 */
export class SystemClock implements Clock {
  public now(): string {
    return new Date().toISOString();
  }
}

/**
 * Unique ID generator adapter
 */
export class CryptoIdGenerator implements IdGenerator {
  private counter = 0;

  public next(): string {
    this.counter += 1;
    return `gen-${Date.now()}-${this.counter}`;
  }
}

/**
 * Basic in-memory telemetry adapter
 */
export class InMemoryTelemetryAdapter implements TelemetryPort {
  private readonly events: TelemetryEvent[] = [];

  public emit(event: TelemetryEvent): void {
    this.events.push(event);
  }

  public getEmittedEvents(): readonly TelemetryEvent[] {
    return this.events;
  }
}

/**
 * Pass-through / regex redaction adapter
 */
export class BasicRedactionAdapter implements RedactionPort {
  public redactText(raw: string): string {
    // Basic pattern for potential tokens or sensitive secrets
    return raw.replace(/Bearer\s+[A-Za-z0-9-_.]+/gi, 'Bearer [REDACTED]');
  }

  public redactObject<T extends object>(obj: T): T {
    const serialized = JSON.stringify(obj);
    const redacted = this.redactText(serialized);
    return JSON.parse(redacted) as T;
  }
}

export * from './persistence/sqlite-durable-store.js';
