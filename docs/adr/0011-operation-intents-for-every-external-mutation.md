# ADR-0011: Operation intents for every external mutation

- **Status:** Accepted
- **Date:** 2026-09-30
- **Deciders:** Pulkit
- **Related:** RFC-0001

## Context
A worker can crash between calling Railway and recording the result. A timeout does not say whether the resource was created. The Railway API's idempotency support is unverified.

## Decision
Every mutation follows: validate approval and plan membership → compare expected vs actual state → insert `operation_intent (logical_key UNIQUE)` → execute → reconcile. Ambiguous outcomes pause for reconciliation instead of retrying. Deterministic ownership names aid discovery but are not treated as proof.

## Consequences
Crash-safe, auditable mutations. Every adapter call needs a reconcile function.

## Alternatives considered
Rely on Temporal activity retries alone (duplicates on ambiguous failures).
