# ADR-0006: Operational guardrails: cohort comparison plus absolute limits

- **Status:** Accepted
- **Date:** 2026-09-30
- **Deciders:** Pulkit
- **Related:** RFC-0001

## Context
Cohort comparison cannot see shared-dependency failures. A single absolute threshold cannot attribute harm to the release. Neither is a statistical safety proof.

## Decision
Promotion decisions use concurrent exposed-vs-control comparison with freshness, minimum-duration and minimum-sample gates, evaluated at fixed checkpoints. A separate emergency mechanism uses absolute service-health limits and the pre-rollout baseline. The product describes these as operational guardrails with calibration-required parameters.

## Consequences
Transparent, explainable decisions. False alarm and miss rates must be measured, not claimed.

## Alternatives considered
Sequential testing or a Bayesian engine (overreach for v1); before/after comparison only (confounded by traffic changes).
