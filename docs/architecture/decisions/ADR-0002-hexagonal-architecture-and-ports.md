# ADR-0002: Hexagonal Architecture and Port Declarations

## Status
Accepted

## Context
The core domain must remain completely decoupled from I/O mechanisms, databases (SQLite), network transport, process spawning, and UI frameworks.

## Decision
Declare pure TypeScript interfaces (ports) in `packages/core-domain/src/ports/`:
1. `Clock` & `IdGenerator` (deterministic primitives)
2. `EventStorePort`, `SnapshotStorePort`, `ActionDedupeStorePort`, `OutboxPort` (storage abstractions)
3. `PolicyEvaluatorPort`, `CapabilityRegistryPort` (domain governance)
4. `WorkerRuntimePort`, `RouteAdapterPort` (runtime abstraction)
5. `TelemetryPort`, `RedactionPort` (observability and security)

No port implementation or direct Node.js built-in module (`fs`, `child_process`, `net`, `sqlite3`) is allowed in `core-domain`.

## Consequences
- Domain logic is 100% testable in isolation using deterministic mocks and fixtures.
- Infrastructure adapters can be swapped or implemented in subsequent phases without affecting domain models.
