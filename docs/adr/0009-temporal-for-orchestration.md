# ADR-0009: Temporal for orchestration

- **Status:** Accepted (hosting decided 2026-10-06, Spike 001 Q8, issue #4)
- **Date:** 2026-09-30
- **Deciders:** Pulkit
- **Related:** RFC-0001, Spike 001 Q8, #4

## Context
The product is mostly waiting: for deployments, approvals, observation windows, retries and cleanup. It must survive worker crashes mid-operation.

## Decision
Use Temporal (TypeScript SDK). Workflows hold lifecycle orchestration; activities perform I/O through the operation intent protocol.

**Hosting:**

| Environment | Temporal |
|---|---|
| Local development | Temporal CLI dev server in `compose.yaml` |
| CI | Temporal test environment (time skipping), no external server |
| Deployed controller | **Temporal Cloud**: one namespace, API-key auth over TLS |

The worker and API read `TEMPORAL_ADDRESS`, `TEMPORAL_NAMESPACE` and `TEMPORAL_API_KEY`. These are the names Temporal's `@temporalio/envconfig` loader uses. Locally the key is empty and the connection is plaintext to `localhost:7233`. The API key lives only in Railway variables and `.env`, and is never logged.

## Consequences
Durable timers, signals and compensation come for free. Workflow determinism rules must be followed.

Choosing Cloud for hosting:
- No server to operate: no upgrades, schema migrations or backups for Temporal's own database. M1 time goes to Switchyard's core.
- Cost: $150 of credits for 90 days, then $50 per million actions plus storage (temporal.io/pricing, fetched 2026-10-01). The credit window covers M1–M5. The demo's action count is measured, not estimated, before the credits run out.
- The controller depends on a second vendor and is not entirely on Railway. Worker code is the same for every Temporal deployment, so moving to self-hosted later is a configuration and operations change, not a rewrite.
- Credentials: one API key, in Railway variables only. Rotating it means updating the variable and restarting the worker and API.

## Alternatives considered
Postgres job queue plus cron (reimplements durable execution); Inngest or Trigger.dev (viable, but Temporal matches the JD and is the more rigorous model).

Hosting alternatives:
- **Self-hosted on Railway** (Temporal server plus its own Postgres): rejected for v1. Setup was judged at a day or more inside a two-week M1, with ongoing upgrades, schema migrations and backups. It stays viable later because worker code doesn't change.
- **The dev server in production**: rejected. It is a single process with SQLite, built for development.
