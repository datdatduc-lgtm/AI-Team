# ADR-0003: JSON Schema Draft 2020-12 and TypeScript Code Generation

## Status
Accepted

## Context
UI Data Contract v1.0.0 requires machine-readable contract specifications. Hand-writing TypeScript types and JSON Schemas separately leads to schema drift and subtle protocol bugs.

## Decision
1. JSON Schema Draft 2020-12 is the Single Source of Truth for all protocol envelopes and payloads.
2. Use `$defs` for reusable sub-definitions (prohibiting OpenAPI `components.schemas`).
3. Use `json-schema-to-typescript` to generate TypeScript types automatically.
4. Generated files must include `/* AUTO-GENERATED — DO NOT EDIT */`.
5. Schema validation is powered by `Ajv 2020` in fail-closed mode (`allErrors: true`).

## Consequences
- Zero type drift between runtime validators and compile-time TypeScript types.
- Strict compliance with UI Data Contract v1.0.0.
