# ADR-0007: Recovery is a workflow with evidence

- **Status:** Accepted
- **Date:** 2026-09-30
- **Deciders:** Pulkit
- **Related:** RFC-0001

## Context
A successful flag write or redeploy call proves nothing about service state. SDKs refresh in the background, and errors can have other causes.

## Decision
Recovery is `disabling → confirming_propagation → verifying_recovery → recovery_verified | recovery_failed`. Propagation is confirmed from exposure events tagged with the flag value. Recovery is confirmed from the affected metric. `recovery_failed` is a first-class outcome.

## Consequences
The UI never claims resolution without evidence. Requires app instrumentation.

## Alternatives considered
Mark recovered on a successful API call (overclaims).
