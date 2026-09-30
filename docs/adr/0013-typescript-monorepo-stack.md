# ADR-0013: TypeScript monorepo stack

- **Status:** Proposed
- **Date:** 2026-09-30
- **Deciders:** Pulkit
- **Related:** RFC-0001

## Context
The JD emphasizes TypeScript, GraphQL and Temporal. One language across UI, API and workers keeps domain types shared.

## Decision
pnpm workspaces + Turborepo. `apps/web` (Next.js), `apps/api` (GraphQL Yoga + Pothos), `apps/worker` (Temporal TS), `apps/demo-orders` (Hono + Postgres), `apps/probe-runner`; `packages/domain`, `packages/db` (Drizzle with hand-written SQL migrations for partial indexes and triggers), `packages/railway`. Vitest for tests, Playwright for probes and end-to-end tests.

## Consequences
Shared types end to end. Monorepo tooling overhead.

## Alternatives considered
Separate repos (type drift); Prisma (weaker support for partial indexes and triggers in migrations).
