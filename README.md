# AI-TEAM Monorepo

Foundation repository for AI-Team Architecture & Protocols.

## Packages

- `packages/ui-contract`: Standalone JSON Schemas (Draft 2020-12), type generation, validators, migrations, and protocol fixtures.
- `packages/core-domain`: Pure domain models and hexagonal ports. Zero external I/O or infrastructure dependencies.
- `packages/core-application`: Application services and orchestration contracts. Depends only on `core-domain` and `ui-contract`.
- `packages/core-infrastructure`: Adapter implementations for hexagonal ports.
- `packages/test-harness`: Deterministic test runners, clock/ID fixtures, and architecture guard validation.
- `packages/desktop-ui`: Placeholder directory. **No production UI or Electron in P0.**

## Phase

Current Phase: `P0.0 / P0.1`
- `P0.0 — Repository & Architecture Guardrails`
- `P0.1 — UI Contract v1.0.0 / Schemas / Validation / Versioning`
