# RFC-0001: Switchyard architecture

| | |
|---|---|
| Status | Draft (accepted in part; items pending Spike 001 are marked ⏳) |
| Author | Pulkit |
| Created | 2026-09-30 |
| Related | ADR-0002…0013, `data-model.md`, `state-machines.md`, `failure-modes.md` |

## 1. Context
Railway makes deploying easy and now exposes feature flags, sandboxes and agent tooling. Nothing records *why* a release was allowed to proceed, or ties that judgement to the exact artifact that shipped. Switchyard fills that gap for one well-scoped workload.

## 2. Goals
- G1: Every production exposure traces back to a sealed evidence bundle and a plan-bound approval.
- G2: Rehearsal and production run the same image digest.
- G3: Every external mutation is recorded, reconciled and recoverable after a controller crash.
- G4: No temporary resource outlives its rehearsal without being visible as `needs_attention`.
- G5: Every automated decision can be explained from stored data.

## 3. Non-goals
See `../product/brief.md`.

## 4. Architecture

| Layer | Implementation | Notes |
|---|---|---|
| Web | React (Next.js App Router) | Release review, live progress via SSE, evidence views |
| API | TypeScript GraphQL (Yoga + Pothos) | Typed schema, explicit mutations, authn on every mutation |
| Orchestration | Temporal (TS SDK) workers | Durable waits for deployments, approvals, windows, cleanup |
| Persistence | PostgreSQL | Controller state; relational integrity is the main defense |
| Railway integration | `packages/railway` adapter | GraphQL API; separate flag adapter (flags are Priority Boarding) ⏳ |
| Telemetry | App emits exposure and outcome events → Postgres | ClickHouse only if measured volume warrants it |
| Probes | `apps/probe-runner` in the rehearsal project | Limited credentials; emits check results |
| Live updates | Server-sent events | Workflow progress and decisions |

Deployment: the controller (web, api, worker, Postgres, Temporal) lives in its own Railway project. Targets and rehearsals live in other projects.

## 5. Key protocols

### 5.1 Artifact identity (ADR-0002)
Build once and deploy by digest. A candidate is `(registry repository, image digest, platform)`. The commit is provenance only. ⏳ Verify that Railway can deploy a service from an image digest; otherwise use a registry-backed CI build.

### 5.2 Rehearsal isolation (ADR-0003)
Each rehearsal gets its own ephemeral Railway project. Flags are project-scoped, so this cleanly separates rehearsal flag state from production. It is a deliberate choice, not the only possible one; namespacing within one project was rejected for v1. Every created resource is recorded in the ledger.

### 5.3 External mutation protocol (ADR-0011)
Before each mutation:
1. Confirm the approval is valid and unrevoked, and that the operation belongs to the approved plan.
2. Read actual state and compare it with the expected state for this step.
3. Insert an `operation_intent` with a unique logical key, expected state and desired state.
4. Execute.
5. Reconcile: read back and record the outcome. After Switchyard's own success, advance the expected state.

An ambiguous outcome (timeout, 5xx after send) sets the intent to `ambiguous` and pauses. The system must tell "not created" apart from "created but not yet discoverable" before retrying. Deterministic resource names (`sy-{rehearsalId}-{role}`) help discovery but are not sufficient alone.

Rechecking narrows time-of-check/time-of-use gaps but can't close them without provider-side conditional writes. The UI shows the last successful reconciliation time.

### 5.4 Approval binding (ADR-0012)
An approval authorizes a **plan manifest**, serialized canonically (RFC 8785 JSON) and hashed with SHA-256:

```
target identity · candidate digest + platform · sealed evidence hash
expected starting configuration fingerprint · policy version
permitted activation steps · permitted recovery actions · expiry
```

Both the hash and the manifest are stored. A changed candidate, evidence bundle or policy invalidates promotion. Emergency disable remains authorized even when promotion is invalidated.

### 5.5 Webhooks (ADR-0010)
Railway webhooks are unsigned, best-effort, unordered, retried up to 3 times, and fire across all environments of a project. The receiver:
- authenticates with a secret custom header,
- stores the receipt in `webhook_inbox` (deduplicated by payload hash),
- returns 2xx quickly,
- signals the relevant workflow to reconcile.

Webhooks never carry authority. Receiver health is monitored: persistent failures cause Railway to pause delivery for 24h, so polling reconciliation must work without webhooks.

### 5.6 Flags (⏳ Spike 001)
Railway flags are a project-scoped typed registry. Rules are evaluated at read time; when rules disagree, the default wins. The SDK refreshes in the background. Implications:
- Switchyard owns a rule-ID namespace (`sy-{releaseId}-*`). Any foreign rule on the controlled flag counts as a conflict and stops automatic progression.
- A successful flag write is not propagation. Propagation is confirmed from exposure events tagged with the flag value.
- There is no flag change webhook, so conflict detection polls. Nominal latency is the poll interval, but real latency can be longer. Show the last reconciliation time.

### 5.7 Health decisions
See `health-policy.md`. Cohort comparison drives promotion. Absolute service-health limits drive emergency stops. Decisions are made at fixed checkpoints and always stored with sample counts and freshness.

## 6. Lifecycles
Three independent lifecycles (rehearsal, release, cleanup). See `state-machines.md`. Cancellation during activation starts the configured stop/recovery procedure; it never just marks the row terminal.

## 7. Security
See `../../SECURITY.md`.

## 8. Alternatives considered
- Build from commit in each environment: rejected (G2).
- Environment fork inside the production project for rehearsal: rejected for v1 because of shared project-scoped flags.
- Cron plus a state table instead of Temporal: rejected, since durable timers, signals and compensation are the core of the product (ADR-0009).

## 9. Open questions
Tracked in `../spikes/spike-001-platform-verification.md`.
