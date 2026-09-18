# UI Data Contract v1.0.0 Specification

## 1. Overview & Source of Truth

This document outlines the frozen specification for **UI Data Contract v1.0.0** within the AI-Team architecture.
The **JSON Schemas Draft 2020-12** located at `packages/ui-contract/schemas/` serve as the single machine-readable Source of Truth. TypeScript types are generated automatically via `pnpm --filter @ai-team/ui-contract codegen`.

---

## 2. Invariants & Protocol Errata

### 2.1 operationId Semantics
- `operationId` represents **ONE LOGICAL OPERATION**.
- When retrying an action due to network timeout, reconnect, lost ACK, or transient error, the client **MUST REUSE THE SAME `operationId`**.
- A new `operationId` is generated only when creating a distinct, new logical action.

### 2.2 Session vs Goal Decoupling
- `SessionState` and `GoalState` are independent aggregates.
- `SessionStatus`: `OFF`, `STARTING`, `CHECKING_READINESS`, `READY`, `READY_DEGRADED`, `BLOCKED`, `ENDING`.
- `GoalStatus`: `INTAKE`, `RESOLVING_CAPABILITIES`, `READY`, `RUNNING`, `PAUSING`, `PAUSED`, `RECOVERING`, `WAITING_FOR_USER`, `BLOCKED`, `FAILED`, `COMPLETED`.
- The UI must never infer Goal state from Session state or vice-versa.

### 2.3 Agent vs Worker Decoupling
- **Agent**: Logical AI persona / team member (`agentId`, `displayName`, `healthStatus`, `sessionRole`, `goalRole`, `canContinueWithoutAgent`, `userActionRequired`).
- **Worker**: Managed execution runtime process (`workerId`, `ownedByAgentId`, `workState`, `supportsPauseSafepoint`, `ownership`, `currentTaskSummary`, `telemetry`).
- An agent does not directly equal a worker process.

### 2.4 Health vs Work State Decoupling
- `HealthStatus`: `HEALTHY`, `DEGRADED`, `UNHEALTHY`, `UNKNOWN`.
- `WorkState`: `IDLE`, `WORKING`, `PAUSED`, `STOPPED`, `DRAINING`.
- A healthy agent/worker can be idle; an unhealthy worker can be stopped. The two states are never conflated.

### 2.5 Strict Worker Ownership Enum
- Allowed values: strictly `OWNED`, `BORROWED`, `FOREIGN`.

---

## 3. Baseline UI Action Intents (12 Total)

1. `INITIALIZE_AI_TEAM`
2. `SET_SESSION_TEAM`
3. `CHECK_SESSION_READINESS`
4. `CAPTURE_FOCUSED_ROUTE`
5. `SUBMIT_GOAL`
6. `ENABLE_CAPABILITY`
7. `RESOLVE_CAPABILITY_REQUIREMENT`
8. `START_GOAL_EXECUTION`
9. `STOP_CURRENT_GOAL`
10. `PAUSE_WORKER_SAFEPOINT`
11. `EXECUTE_RECOMMENDED_ACTION`
12. `TERMINATE_SESSION`

---

## 4. Host Capability Registry

Host capabilities use namespaced keys:
- `host.file.openFolder`
- `host.terminal.attach`
- `host.window.focus`
- `host.notifications`
- `host.nativePreview`

Each capability entry defines `{ supported: boolean, description?: string, metadata?: object }`.
