# ADR-0008: Cleanup is an independent lifecycle

- **Status:** Accepted
- **Date:** 2026-09-30
- **Deciders:** Pulkit
- **Related:** RFC-0001

## Context
If cleanup is a step inside the release workflow, cancellation or failure can skip it and leave billable resources running.

## Decision
Every terminal rehearsal state spawns a cleanup workflow with its own ID, retries and `needs_attention` state. A scheduled janitor sweeps the resource ledger for TTL breaches. Spend limits are best-effort (usage reporting and deletion can lag) and are paired with TTLs and resource limits.

## Consequences
Leftover resources are always visible. More moving parts.

## Alternatives considered
`finally` blocks in the release workflow (lost on cancellation paths and crashes).
