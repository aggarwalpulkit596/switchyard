# Health policy (v1)

Switchyard applies **operational guardrails**, not statistical proof. Every decision is stored with its inputs, and the UI shows them.

## Two separate mechanisms

| Mechanism | Purpose | Inputs | Can trigger |
|---|---|---|---|
| **Promotion guardrail** | Decide whether to widen exposure | Concurrent exposed vs control cohorts | advance · hold · inconclusive · stop |
| **Emergency limit** | Catch service-wide harm regardless of attribution | Absolute error rate and p95 across all traffic, plus the pre-rollout baseline | emergency_stop |

The two are kept separate so that a shared-dependency failure (both arms degraded, so the cohorts look identical) still stops the rollout.

## Evaluation rules
1. Evaluate at **fixed checkpoints**: the end of each observation window. The UI shows interim data, but only checkpoints produce decisions. This reduces, but does not eliminate, false alarms across multiple stages and metrics.
2. Evaluation is allowed only if:
   - telemetry is fresh (heartbeat from every known instance within `freshness_max`),
   - the minimum window duration has elapsed,
   - each arm has at least `min_units` unique assignment units.
   Otherwise the verdict is **inconclusive**, with the reason.
3. Promotion compares exposed and control **concurrently** on error rate and p95 latency, using both absolute and relative deltas.
4. An allocation mismatch (observed exposed share far from the intended one) produces inconclusive with a reason to investigate. It does not count as proof of broken instrumentation.

## Policy parameters (demo values, need calibration)

| Parameter | Demo value |
|---|---|
| `steps` | 0% (dark) → 5% → 25% → 50% → 100% |
| `window_min` | 3 min |
| `freshness_max` | 60 s |
| `min_units_per_arm` | 50 |
| `max_error_delta_abs` | +1.0 pp |
| `max_p95_delta_rel` | +25% |
| `emergency_error_rate` | 5% absolute |
| `emergency_p95` | 2× pre-rollout baseline |
| `inconclusive_timeout` | 15 min → escalate to a human |

Policies are versioned (`policy_version`). Changing a policy invalidates promotion approvals bound to the old version.

## What every decision records
Verdict, policy version, window bounds, per-arm unit counts, error rate and p95 per arm, deltas, freshness, reason text, and references to the observation rows.
