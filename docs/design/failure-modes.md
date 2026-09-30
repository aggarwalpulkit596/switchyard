# Failure modes

Each row is a requirement **and** a test case. The test column names the test that must exist before the owning milestone closes.

| # | Scenario | Expected behavior | Mechanism | Test | Milestone |
|---|---|---|---|---|---|
| F1 | Webhook delivered twice or out of order | No duplicate action | Inbox dedupe on payload hash; webhooks only signal reconciliation | `webhook.duplicate.test` | M2 |
| F2 | Webhook receiver down, or Railway pauses delivery for 24h | Progress continues more slowly | Polling reconciliation is always on; webhooks only shorten latency | `reconcile.without-webhooks.test` | M2 |
| F3 | Worker crashes after a create call | No duplicate resource | `operation_intent` recorded before the call; reconcile by ownership name before retrying | `intent.crash-after-create.test` | M1 |
| F4 | Create call times out (ambiguous) | Pause, then resolve by reconciliation | Intent → `ambiguous`; rehearsal → `paused_ambiguous` | `intent.ambiguous.test` | M1 |
| F5 | Railway API rate-limited or unavailable | Back off and pause; never read as an app regression | Adapter error taxonomy (`retryable`, `ambiguous`, `fatal`); `paused: api_unavailable` | `adapter.error-taxonomy.test` | M1 |
| F6 | Resource deletion fails | Retry independently; show remaining resources and TTL | Independent cleanup workflow plus janitor | `cleanup.retry.test` | M1 |
| F7 | Approval applies to an older candidate, evidence or policy | Reject execution and request a new review | Binding hash recomputed and checked before every mutation | `approval.stale.test` | M1 |
| F8 | Dark deployment fails verification | Recover to the previous digest and verify recovery | `deployment_recovery` path | `dark-deploy.recovery.test` | M2 |
| F9 | Telemetry stops arriving | Pause advancement; mark evidence stale | Per-instance heartbeat separates "no traffic" from "pipeline broken" | `health.stale.test` | M4 |
| F10 | Too few assignment units in a cohort | Inconclusive → hold → escalate after a timeout | Minimum unique units per arm | `health.min-sample.test` | M4 |
| F11 | Observed allocation deviates from intended | Investigate, not auto-fail: mark inconclusive with a reason | Count unique units, not requests; tolerance widens at small n | `health.allocation-mismatch.test` | M4 |
| F12 | Someone else changes the flag mid-rollout | Stop automatic progression; show a conflict | Rule-ID namespace plus fingerprint polling; show last reconciliation time | `flag.conflict.test` | M3 |
| F13 | Flag disabled but errors continue | Report `recovery_failed`; do not claim resolution | Propagation confirmed from exposure events, then metric recovery checked | `recovery.not-recovered.test` | M4 |
| F14 | Controller down during activation | Exposure frozen at the current step and unmonitored. Stated honestly, alerted externally | External uptime check on the controller; documented limit | runbook | M4 |
| F15 | Two releases target the same service | Second one rejected | Partial unique index on `releases(target_id)` | `release.single-active.test` | M1 |
| F16 | Secrets appear in logs or evidence | Redacted before storage and display | Redactor on the evidence sealing path and log views | `redaction.test` | M1 |
| F17 | Shared-dependency failure degrades both arms | Emergency stop on absolute limits; attribution labeled uncertain | Absolute limits plus pre-rollout baseline comparison | `health.shared-degradation.test` | M5 |

## Coverage statement shown in the UI
"Switchyard sees changes it made itself. It sees deployment status and alerts via webhooks and polling, and flag changes via polling. It does not see variable, domain or DNS changes made elsewhere: external change visibility is **partial**."
