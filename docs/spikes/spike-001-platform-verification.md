# Spike 001: Platform verification

- **Timebox:** 3 working days (M0). Stop at the timebox and decide with what is known.
- **Output:** answers below (✅ confirmed · ❌ not possible · ⚠️ partial), a runnable script per question in `spikes/001/`, and ADR status updates.
- **Rule:** no product UI until the blocking questions (B) are answered.

| # | Question | Blocking? | Evidence required | Fallback if ❌ | Answer |
|---|---|---|---|---|---|
| Q1 | Can a service be deployed from an image **digest** (`repo@sha256:…`) via the public GraphQL API? | B | Script deploys by digest; the running image digest is read back | CI builds and pushes to GHCR; deploy by the registry tag after resolving it to a digest | |
| Q2 | Can the built image digest of a Railway-built deployment be read via the API? | | Query output | Always build in CI (ADR-0002) | |
| Q3 | Project create and delete via the API: latency, and is deletion observable (read returns not found)? | B | Timed script, 5 runs | Long-lived rehearsal project with per-run environments (revisit ADR-0003) | |
| Q4 | Do create mutations accept any idempotency key or client-supplied name that is unique per workspace? | | Schema introspection plus test | Ownership name plus reconcile-before-retry (ADR-0011, already planned) | |
| Q5 | Workspace limits on project count and concurrent deployments on the demo plan? | | Docs plus test | Serialize rehearsals | |
| Q6 | Flag management via the API or SDK: create/update/delete a flag and rules with a project token; read rules back with IDs? | B for M3 | Script round-trip | CLI wrapper (`railway flag`) inside the worker; or drop activation and ship rehearsal-only | |
| Q7 | Flag SDK refresh interval and behavior under network loss (measured) | | Timed measurement | Longer propagation windows in policy | |
| Q8 | Temporal hosting: Temporal Cloud free tier vs self-hosted on Railway (setup time, cost) | | Decision note | — | |
| Q9 | Webhook custom-header auth works; payload shape for deployment events, including `isEphemeral` | | Captured payloads (redacted) | Polling only | |
| Q10 | Can a rehearsal Postgres be seeded from fixtures via a pre-deploy command or a probe-runner job? | | Script | Seed from probe-runner over private networking | |
| Q11 | Rate limits on the public API (documented or observed) | | Docs plus observed headers | Adapter-level token bucket | |
| Q12 | Deployment metrics (HTTP status and latency) readable via the API at ≥1-minute resolution? | | Query | App-emitted telemetry only (already the plan) | |

## Decision at the end of the spike
- If Q1 or Q3 is ❌ with no fallback: pivot to the fallback architecture and record it in an ADR.
- If Q6 is ❌: M3 is replaced by "manual activation checklist + observation", and the product is rehearsal-and-evidence first. That remains a complete, valuable product.
