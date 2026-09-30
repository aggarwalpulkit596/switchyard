# ADR-0002: Build once, deploy by image digest

- **Status:** Proposed (pending Spike 001 Q1–Q2)
- **Date:** 2026-09-30
- **Deciders:** Pulkit
- **Related:** RFC-0001

## Context
If production rebuilds from a commit, the artifact that was rehearsed is not the artifact that ships. Builds are not reliably reproducible.

## Decision
A candidate is identified by `(registry repository, image digest, platform)`. Rehearsal and production deploy the same digest. The source commit is stored as provenance only. If Railway cannot deploy by digest or expose the built digest, build in CI (GitHub Actions → GHCR) and deploy both from the registry.

## Consequences
Approval can be bound to an immutable artifact. Needs a registry and, possibly, private registry credentials in Railway.

## Alternatives considered
Deploy from the commit in both environments (breaks G2); trust Railway build caching (not an identity guarantee).
