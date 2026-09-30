# ADR-0005: Backward-compatible schema changes only in v1

- **Status:** Accepted
- **Date:** 2026-09-30
- **Deciders:** Pulkit
- **Related:** RFC-0001

## Context
Disabling the flag or redeploying the previous digest must leave the old code working against the current schema.

## Decision
v1 accepts only expand-style migrations (additive columns and tables, new indexes). Destructive changes and schema contraction are out of scope. Candidates declare their migrations, and the evidence page lists them as a checklist item.

## Consequences
Recovery stays sound. Some real-world releases are unsupported, which is stated in the UI.

## Alternatives considered
Automatic down-migrations (unsafe with data); ignoring migrations (false confidence).
