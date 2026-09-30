# ADR-0003: Separate ephemeral Railway project per rehearsal

- **Status:** Accepted
- **Date:** 2026-09-30
- **Deciders:** Pulkit
- **Related:** RFC-0001

## Context
Railway feature flags are scoped to a project. An environment fork inside the production project would share production's flags. Cleanup also needs a small blast radius.

## Decision
Each rehearsal gets its own Railway project named `sy-reh-{rehearsalId}`. Every resource created in it is recorded in the `resources` ledger. Cleanup deletes the project and verifies absence through reconciliation.

## Consequences
Clean flag isolation and simple teardown. Costs: project creation latency, possible workspace project limits (Spike Q5), and configuration must be copied explicitly instead of inherited.

## Alternatives considered
Environment fork plus flag namespacing (needs app-side key mapping and leaks rehearsal rules into production's flag registry); a long-lived shared rehearsal project (state bleeds between runs).
