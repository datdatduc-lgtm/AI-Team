import { describe, it, expect } from 'vitest';
import {
  StepClock,
  FrozenClock,
  SequenceIdGenerator,
  FixedIdGenerator,
} from '../src/deterministic/index.js';

describe('Deterministic Clock & ID Generator Ports Implementation', () => {
  describe('StepClock', () => {
    it('advances predictably with configured step increment', () => {
      const clock = new StepClock('2026-09-18T10:00:00.000Z', 1000);
      expect(clock.now()).toBe('2026-09-18T10:00:00.000Z');
      expect(clock.now()).toBe('2026-09-18T10:00:01.000Z');
      expect(clock.now()).toBe('2026-09-18T10:00:02.000Z');
    });

    it('allows manual time jumping and peeking', () => {
      const clock = new StepClock('2026-09-18T10:00:00.000Z', 1000);
      expect(clock.peek()).toBe('2026-09-18T10:00:00.000Z');
      clock.advance(5000);
      expect(clock.peek()).toBe('2026-09-18T10:00:05.000Z');
      clock.set('2026-10-01T00:00:00.000Z');
      expect(clock.now()).toBe('2026-10-01T00:00:00.000Z');
    });
  });

  describe('FrozenClock', () => {
    it('returns the exact immutable timestamp across multiple calls', () => {
      const clock = new FrozenClock('2026-09-18T12:00:00.000Z');
      expect(clock.now()).toBe('2026-09-18T12:00:00.000Z');
      expect(clock.now()).toBe('2026-09-18T12:00:00.000Z');
      expect(clock.now()).toBe('2026-09-18T12:00:00.000Z');
    });
  });

  describe('SequenceIdGenerator', () => {
    it('generates padded sequential IDs deterministically', () => {
      const idGen = new SequenceIdGenerator('evt', 1);
      expect(idGen.next()).toBe('evt-0001');
      expect(idGen.next()).toBe('evt-0002');
      expect(idGen.next()).toBe('evt-0003');

      idGen.reset(10);
      expect(idGen.next()).toBe('evt-0010');
    });
  });

  describe('FixedIdGenerator', () => {
    it('replays a predefined sequence of IDs', () => {
      const idGen = new FixedIdGenerator(['id-alpha', 'id-beta', 'id-gamma']);
      expect(idGen.next()).toBe('id-alpha');
      expect(idGen.next()).toBe('id-beta');
      expect(idGen.next()).toBe('id-gamma');
      expect(() => idGen.next()).toThrow(/exhausted/);
    });
  });
});
