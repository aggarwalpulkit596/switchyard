# ADR-0009: Temporal for orchestration

- **Status:** Proposed (hosting decided in Spike Q8)
- **Date:** 2026-09-30
- **Deciders:** Pulkit
- **Related:** RFC-0001

## Context
The product is mostly waiting: for deployments, approvals, observation windows, retries and cleanup. It must survive worker crashes mid-operation.

## Decision
Use Temporal (TypeScript SDK). Workflows hold lifecycle orchestration; activities perform I/O through the operation intent protocol. Hosting is either Temporal Cloud or a self-hosted server on Railway, decided within one day of spike time.

## Consequences
Durable timers, signals and compensation come for free. Adds an operational dependency; workflow determinism rules must be followed.

## Alternatives considered
Postgres job queue plus cron (reimplements durable execution); Inngest or Trigger.dev (viable, but Temporal matches the JD and is the more rigorous model).
