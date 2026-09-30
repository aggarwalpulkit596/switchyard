# ADR-0010: Webhooks are hints; the API is the source of truth

- **Status:** Accepted
- **Date:** 2026-09-30
- **Deciders:** Pulkit
- **Related:** RFC-0001

## Context
Railway webhooks are unsigned, best-effort, unordered, retried up to 3 times, fire for all environments in a project, and delivery pauses for 24h after persistent failures.

## Decision
The receiver authenticates via a secret custom header (not a URL secret), stores receipts in `webhook_inbox` deduplicated by payload hash, returns 2xx quickly, and signals workflows to reconcile. Webhooks never trigger mutations. Polling reconciliation runs regardless.

## Consequences
Correctness does not depend on delivery. Webhooks only reduce latency.

## Alternatives considered
Webhooks as an event log (unsafe given the delivery semantics); URL-embedded secret (ends up in access logs).
