# ADR-0012: Approval binds a canonical plan manifest

- **Status:** Accepted
- **Date:** 2026-09-30
- **Deciders:** Pulkit
- **Related:** RFC-0001

## Context
Approving a release in the abstract lets the thing being approved drift afterwards.

## Decision
Approval stores a plan manifest (target, digest and platform, evidence hash, expected starting configuration fingerprint, policy version, permitted activation steps, permitted recovery actions, expiry), serialized with RFC 8785 and hashed with SHA-256. Both are stored. Validity is rechecked before every mutation. The expected state advances after Switchyard's own successful changes. Emergency disable remains authorized after promotion is invalidated.

## Consequences
Drift is detectable and explained. Who may approve is enforced by authentication and database controls, not by the hash.

## Alternatives considered
Approval as a boolean on the release (no binding); signing with keys (overkill for v1).
