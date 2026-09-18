import type { Clock } from '@ai-team/core-domain';

export class StepClock implements Clock {
  private currentTimeMs: number;
  private readonly stepMs: number;

  constructor(initialIso: string = '2026-09-18T00:00:00.000Z', stepMs: number = 1000) {
    this.currentTimeMs = new Date(initialIso).getTime();
    this.stepMs = stepMs;
  }

  public now(): string {
    const iso = new Date(this.currentTimeMs).toISOString();
    this.currentTimeMs += this.stepMs;
    return iso;
  }

  public peek(): string {
    return new Date(this.currentTimeMs).toISOString();
  }

  public set(isoString: string): void {
    this.currentTimeMs = new Date(isoString).getTime();
  }

  public advance(milliseconds: number): void {
    this.currentTimeMs += milliseconds;
  }
}

export class FrozenClock implements Clock {
  private readonly fixedIso: string;

  constructor(fixedIso: string = '2026-09-18T00:00:00.000Z') {
    this.fixedIso = fixedIso;
  }

  public now(): string {
    return this.fixedIso;
  }
}
