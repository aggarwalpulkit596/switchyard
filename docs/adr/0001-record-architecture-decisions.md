# ADR-0001: Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-09-30
- **Deciders:** Pulkit
- **Related:** RFC-0001

## Context
Decisions made in chat or in heads get lost. The project is designed to be reviewed asynchronously by people who weren't present.

## Decision
Use lightweight ADRs in `docs/adr/`, numbered sequentially and append-only. A superseded ADR stays, with a link to its replacement.

## Consequences
Every constraining decision has a findable reason. PRs that make a decision include the ADR.

## Alternatives considered
Wiki pages (drift away from the code); decisions in the PR description only (not discoverable).
