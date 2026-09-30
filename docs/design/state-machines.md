# State machines

Three independent lifecycles. A failure or cancellation in one never silently ends another. Transitions are implemented as pure functions in `packages/domain` and exhaustively unit-tested.

## Rehearsal

```mermaid
stateDiagram-v2
  [*] --> queued
  queued --> provisioning
  provisioning --> testing
  provisioning --> failed : provisioning error
  provisioning --> paused_ambiguous : ambiguous create result
  paused_ambiguous --> provisioning : reconciled not created
  paused_ambiguous --> testing : reconciled created
  testing --> evidence_sealed : all checks recorded
  testing --> failed : check execution error
  queued --> cancelled
  provisioning --> cancelled
  testing --> cancelled
  evidence_sealed --> [*]
  failed --> [*]
  cancelled --> [*]
```

Every terminal rehearsal state spawns a cleanup run. `evidence_sealed` may contain failed checks: sealing records what happened, and approval policy decides whether it is acceptable.

## Release

```mermaid
stateDiagram-v2
  [*] --> awaiting_approval
  awaiting_approval --> approved : plan-bound approval
  approved --> awaiting_approval : candidate/evidence/policy changed (approval invalidated)
  approved --> deploying_dark
  deploying_dark --> verifying_deployment
  verifying_deployment --> activating : dark checks pass
  verifying_deployment --> deployment_recovery : dark checks fail
  deployment_recovery --> recovery_verified
  deployment_recovery --> needs_attention
  activating --> activating : advance step
  activating --> paused : insufficient_evidence | stale_telemetry | conflict | api_unavailable
  paused --> activating : resumed (human or condition cleared)
  activating --> disabling : stop | emergency_stop | cancel
  paused --> disabling : cancel
  disabling --> confirming_propagation
  confirming_propagation --> verifying_recovery
  verifying_recovery --> recovery_verified
  verifying_recovery --> recovery_failed
  activating --> completed : 100% held for final window
  completed --> [*]
  recovery_verified --> [*]
  recovery_failed --> needs_attention
  needs_attention --> [*]
```

Rules:
- `paused` always stores the phase, the reason and the intended recovery action.
- `cancel` during `activating` or `paused` routes through `disabling`. It is never a direct terminal transition.
- Emergency disable is permitted even when the promotion approval has been invalidated (see the plan's `permitted_recovery_actions`).
- `recovery_failed` means the flag is off and propagation is confirmed, but the metric did not recover. The UI must not claim resolution.

## Cleanup

```mermaid
stateDiagram-v2
  [*] --> pending
  pending --> deleting
  deleting --> verifying_absence
  verifying_absence --> verified_gone : reconciliation confirms absence
  verifying_absence --> retrying : resource still present
  deleting --> retrying : delete error
  retrying --> deleting : backoff elapsed
  retrying --> needs_attention : max retries or TTL breach
  needs_attention --> deleting : manual retry
  verified_gone --> [*]
```

Cleanup runs under its own Temporal workflow ID derived from the rehearsal ID. Release cancellation, rehearsal failure or a controller restart cannot cancel it. A janitor schedule also sweeps `resources` for rows past their TTL that are not `verified_gone`.
