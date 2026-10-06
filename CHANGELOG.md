# Changelog

All notable changes are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]
### Changed
- ADR-0009 accepted: Temporal Cloud hosts the deployed controller's workflows; the dev server is used locally and the test environment in CI. Spike 001 Q8 answered (#4).

### Added
- M1 database schema in `packages/db`: 12 tables with composite workspace foreign keys, partial unique indexes and state checks; immutability triggers (ADR-0014); 26 constraint tests against a real Postgres; CI checks that migrations match the schema (#6).
- ADR-0014: immutability enforced by triggers, not grants.
- Local development environment: `compose.yaml` with PostgreSQL 16 and a Temporal dev server, a documented `.env.example`, and `docs/engineering/local-dev.md` (#5).
- Monorepo scaffold: pnpm workspaces, Turborepo, strict TypeScript, ESLint (typescript-eslint strict type-checked), Prettier and Vitest, with empty `apps/*` and `packages/*` workspaces (#1).
- Project charter, RFC-0001, ADRs 0001–0013, data model, state machines, failure modes, health policy, roadmap and Spike 001 plan.
