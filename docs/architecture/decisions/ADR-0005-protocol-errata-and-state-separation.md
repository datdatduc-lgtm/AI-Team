# ADR-0005: Protocol Errata, State Separation, and Operation Identity

## Status
Accepted

## Context
To prevent architectural ambiguity and state corruption:
1. `operationId` semantics must be explicit regarding retries.
2. `SessionState` and `GoalState` must be strictly decoupled.
3. `AgentState` and `WorkerState` must remain independent invariants.
4. `HealthStatus` and `WorkState` must not be conflated.
5. Ownership must strictly be `OWNED`, `BORROWED`, or `FOREIGN`.

## Decision
1. **operationId**: Identifies ONE LOGICAL OPERATION. Any retry caused by timeout, reconnect, network failure, or lost ACK must reuse the same `operationId`. Only new logical intents generate a new `operationId`.
2. **Session ≠ Goal**: Session represents overall workspace lifecycle; Goal represents an active AI objective. UI must not infer Goal state from Session state or vice-versa.
3. **Agent ≠ Worker**: Agent represents logical AI persona/role; Worker represents managed execution process.
4. **Health ≠ Work State**: Agent Health (`HEALTHY`, `DEGRADED`, `DISCONNECTED`, `OFF`) is separate from Worker Work State (`IDLE`, `RUNNING`, `PAUSING_SAFEPOINT`, `PAUSED`, `RECOVERING`, `STUCK`, `TERMINATED`).
5. **Ownership Enum**: Restrict strictly to `["OWNED", "BORROWED", "FOREIGN"]`.
6. **Semantic States**: Strictly decouple and lock Route (`CONFIGURED`, `VERIFYING`, `READY`, `AUTH_REQUIRED`, `WRONG_CONVERSATION`, `MISSING`, `BROKEN`), Capability Requirement (`AVAILABLE`, `DISABLED`, `UNCONFIGURED`, `MISSING`, `INCOMPATIBLE`), and System Recovery (`RECOVERING`, `WAITING_FOR_USER`, `BLOCKED`, `FAILED`).

## Consequences
- Elimination of state machine race conditions and misinterpretations.
- Clean contract compliance matching UX Freeze v1.
