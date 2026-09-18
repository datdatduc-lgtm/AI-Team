export interface Clock {
  /**
   * Returns current timestamp formatted in ISO 8601 string format (e.g. 2026-09-18T00:00:00.000Z).
   */
  now(): string;
}

export interface IdGenerator {
  /**
   * Generates a unique identifier string deterministically or pseudorandomly through port.
   */
  next(): string;
}
