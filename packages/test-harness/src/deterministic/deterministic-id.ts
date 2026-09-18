import type { IdGenerator } from '@ai-team/core-domain';

export class SequenceIdGenerator implements IdGenerator {
  private counter: number;
  private readonly prefix: string;

  constructor(prefix: string = 'id', startAt: number = 1) {
    this.prefix = prefix;
    this.counter = startAt;
  }

  public next(): string {
    const formatted = String(this.counter).padStart(4, '0');
    const id = `${this.prefix}-${formatted}`;
    this.counter += 1;
    return id;
  }

  public reset(startAt: number = 1): void {
    this.counter = startAt;
  }
}

export class FixedIdGenerator implements IdGenerator {
  private readonly sequence: readonly string[];
  private index = 0;

  constructor(sequence: readonly string[]) {
    this.sequence = sequence;
  }

  public next(): string {
    if (this.index >= this.sequence.length) {
      throw new Error(`FixedIdGenerator exhausted all ${this.sequence.length} preset IDs`);
    }
    const id = this.sequence[this.index]!;
    this.index += 1;
    return id;
  }
}
