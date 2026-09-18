# ADR-0004: Deterministic Clock and ID Generator

## Status
Accepted

## Context
Non-deterministic primitives such as `Date.now()`, `new Date()`, `Math.random()`, and `crypto.randomUUID()` in domain and application layers prevent deterministic event replay, debugging, and property testing.

## Decision
1. Define pure ports:
   - `Clock` with `now(): string` (ISO 8601 formatted timestamp).
   - `IdGenerator` with `next(): string` (unique identifier string).
2. Test harness provides deterministic implementations:
   - `StepClock` / `DeterministicClock` with configurable epoch and time-step advancement.
   - `SequenceIdGenerator` / `DeterministicIdGenerator` with reproducible ID sequences.
3. Domain and application components must inject these ports.

## Consequences
- Exact test reproducibility across environments.
- Support for deterministic event replay and time-travel simulation in testing.
