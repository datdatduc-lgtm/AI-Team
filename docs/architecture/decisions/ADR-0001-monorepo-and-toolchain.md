# ADR-0001: Monorepo Structure and Toolchain Selection

## Status
Accepted

## Context
AI-Team requires a deterministic, modular, and enforceable monorepo architecture for Phase P0.0/P0.1. Boundaries between domain, application, infrastructure, contracts, and tests must be strictly isolated.

## Decision
1. **Package Manager**: Use `pnpm` workspaces for dependency isolation, strict hoisting, and fast resolution.
2. **Language**: TypeScript 5.7+ with strict typechecking and ESM (`NodeNext`).
3. **Test Runner**: Vitest for native TypeScript execution, ESM support, and high-performance test execution.
4. **Boundary Isolation**: Packages are structured with clear single responsibilities:
   - `@ai-team/ui-contract`
   - `@ai-team/core-domain`
   - `@ai-team/core-application`
   - `@ai-team/core-infrastructure`
   - `@ai-team/test-harness`
   - `desktop-ui` (placeholder only, no UI/Electron dependencies)

## Consequences
- Clean modularity with zero circular dependencies.
- Strict architecture boundaries enforceable at test and build time.
