# ADR-0004: Verify the dark deployment separately from feature activation

- **Status:** Accepted
- **Date:** 2026-09-30
- **Deciders:** Pulkit
- **Related:** RFC-0001

## Context
Shipping with the flag off still ships new code, dependency changes and migrations. Flag-off only protects code behind the flag.

## Decision
The release lifecycle has distinct `deploying_dark` and `verifying_deployment` phases with their own checks and a `deployment_recovery` path that redeploys the previous digest. Exposure cannot increase until dark verification passes.

## Consequences
Two recovery paths to build and test. Honest coverage of non-flag risk.

## Alternatives considered
Treat the flag as the only safety mechanism (misrepresents risk).
