# 000: System primer

Related: [RFC-0001](../design/rfc-0001-switchyard.md), [ADRs](../adr/), [product brief](../product/brief.md)

This note is the map. It explains the eight ideas the whole design rests on, so later notes can refer back here instead of re-explaining.

## Read: the problem in one paragraph

Deploying is automated; *judging* a release is not. Someone deploys, looks at logs, clicks around, and decides it is fine. That judgement is never recorded, so later nobody can answer: which exact artifact shipped, what was tested, who approved it, and why the rollout continued. Switchyard's answer is the **release record**: a chain of stored facts from artifact → evidence → approval → observations → decisions.

Suggested reading order: product brief → RFC-0001 → state machines → data model → failure modes → health policy → ADRs as they come up.

## Understand: the eight ideas

### 1. Identity: ship exactly what you tested (ADR-0002, goal G2)
A container image **tag** (`orders:v1.4`) is a movable label. A **digest** (`sha256:ab12…`) is the hash of the image manifest, so it cannot point at different content later. Rebuilding from the same commit is not guaranteed to produce the same bytes (dependency resolution, timestamps, base-image updates). So Switchyard builds once and deploys the *digest* to both rehearsal and production. The commit is kept as provenance, meaning where the artifact came from, not what it is.

### 2. Isolation: rehearse where you can't hurt anything (ADR-0003)
A rehearsal is a throwaway copy of the app with synthetic data. Railway feature flags are scoped to a project, so a rehearsal inside the production project would share production's flags. Hence one **ephemeral project per rehearsal** (`sy-reh-{id}`). The cost is slower setup and possible project-count limits; the spike (Q3, Q5) measures both.

### 3. Evidence and binding: approve a thing, not a mood (ADR-0012, goal G1)
Probe results are **sealed** into an immutable evidence bundle, with its *coverage gaps* stated explicitly. An approval then signs a **plan manifest**: the digest, the evidence hash, the policy version, the allowed steps and recovery actions, and an expiry. To make "the same plan" mean the same bytes, the JSON is **canonicalized** (RFC 8785: sorted keys, fixed number format, no whitespace) and hashed with SHA-256. If anything in the plan changes, the hash changes, and the approval no longer covers it (failure mode F7).

### 4. Mutations: record intent before touching the world (ADR-0011, goal G3)
The hardest bug in automation is the crash between "I called the API" and "I wrote down that I did". On restart you don't know whether the resource exists. The protocol:

1. Check the approval.
2. Read the actual state.
3. Insert an `operation_intent` row with a **unique logical key**.
4. Execute the call.
5. **Reconcile**: read back what exists and record it.

A timeout is **ambiguous**, not a failure: the resource may exist. So the workflow pauses and reconciles instead of retrying blindly, because a blind retry is how duplicates happen (F3, F4).

### 5. Truth: the API is the source of truth, webhooks are hints (ADR-0010)
Railway webhooks are unsigned, best-effort, unordered and retried, and delivery pauses for 24h after persistent failures. Treating them as events to act on would make correctness depend on delivery. Instead a webhook only means "go look now", and polling reconciliation runs regardless (F1, F2).

### 6. Durability: the product is mostly waiting (ADR-0009)
Switchyard waits for deployments, approvals, observation windows, retries and cleanup, sometimes for hours, and must survive crashes mid-wait. **Temporal** provides durable execution: workflow code is replayed from a stored event history after a crash, so timers and progress survive. The price: workflow code must be **deterministic** (no direct I/O, randomness or wall-clock reads), and all I/O lives in **activities**.

### 7. Lifecycles: cleanup must not depend on success (ADR-0008, goal G4)
There are three independent state machines: rehearsal, release and cleanup. If cleanup were a `finally` step inside the release, cancellation or a crash could skip it and leave billable resources running. So cleanup has its own workflow ID, retries and a `needs_attention` state, and a janitor sweeps for anything past its TTL (F6).

### 8. Honesty: guardrails are not proof (ADR-0006, ADR-0007)
Two separate mechanisms:
- **Cohort comparison** (exposed vs control users, at fixed checkpoints, with minimum samples and fresh telemetry) decides whether to widen exposure.
- **Absolute limits** (error rate, p95 against the pre-rollout baseline) trigger an emergency stop. This catches failures that hit both cohorts equally, such as a shared database.

Neither is a statistical safety guarantee, and turning a flag off does not undo writes. Recovery is itself a workflow: disable, confirm propagation from exposure events, then confirm the metric recovered. `recovery_failed` is a legitimate outcome.

### Cross-cutting: let the database enforce invariants
Rules like "one active release per target" are **partial unique indexes**, and cross-workspace references are blocked by **composite foreign keys** `(workspace_id, id)`. Application checks can race; a constraint cannot be bypassed by a bug in one code path (data model, principle 4).

## Decide: the big choices and what they cost

| Decision | Rejected alternative | Cost we accepted |
|---|---|---|
| Deploy by digest (ADR-0002) | Rebuild per environment | Needs a registry; pending spike Q1 |
| Project per rehearsal (ADR-0003) | Environment fork in the production project | Setup latency, project limits |
| Temporal (ADR-0009) | Postgres queue plus cron | An operational dependency; determinism rules |
| Intent → execute → reconcile (ADR-0011) | Rely on activity retries | A reconcile function for every adapter call |
| Canonical plan hash (ADR-0012) | Boolean `approved` flag | Canonicalization and hash tests |
| Cohorts plus absolute limits (ADR-0006) | Bayesian or sequential testing | Parameters need calibration and are called guardrails |
| Expand-only migrations (ADR-0005) | Automatic down-migrations | Some real releases are unsupported |

## Execute
Nothing built here; this note is the reading. Its test is whether you can answer the questions below from memory.

## Check yourself
1. Why is a tag not enough to identify an artifact, even if nobody retags it on purpose?
2. A create call times out. List what could be true about the world, and why retrying immediately is wrong.
3. Why can't a webhook ever start a mutation in Switchyard?
4. The shared database slows down for everyone mid-rollout. Which mechanism catches it, and why can't the other one?
5. Why is "flag disabled successfully" not the same as "recovered"?
6. Give one invariant the database enforces and the race it prevents.

## My notes
