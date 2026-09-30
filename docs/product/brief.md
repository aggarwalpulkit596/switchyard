# Product brief

## One line
Switchyard binds release approval to a tested artifact and its evidence, then supervises deployment and feature activation on Railway.

## Target user
A developer maintaining a small Railway application (web/API plus PostgreSQL) who currently deploys, reads logs, checks a few flows by hand, and hopes.

## Core object
The **release record**, which connects:
- the exact image digest (and source commit as provenance)
- the rehearsal configuration and fixture version
- the checks executed and their results
- the approved plan (activation steps, permitted recovery actions, policy version)
- observations and the decisions derived from them

## v1 scope
- One release and one controlled flag per target at a time.
- Workload: web/API service with PostgreSQL. Reference target: `apps/demo-orders`.
- Synthetic fixtures only.
- Explicit application instrumentation for cohort metrics (exposure and outcome events).
- Only changes that can be safely disabled by the controlled flag.
- Backward-compatible (expand-only) schema changes.
- Changes made through Switchyard are recorded. Visibility of external changes is labeled **partial**.
- The controller runs independently of the application it supervises.

## Non-goals (v1)
Automatic database reversal, arbitrary infrastructure restoration, multi-cloud support, incident diagnosis, general-purpose agent execution, statistical safety guarantees.

## Honest limits the UI must state
- Disabling a flag does not undo writes, migrations, emails or payments.
- Guardrail thresholds are demo policy parameters that need calibration.
- A health endpoint alone never earns a functional pass.

## Demo scenario
1. Create a rehearsal from the UI. It provisions an ephemeral project, loads fixtures and runs probes.
2. Review the evidence, including what is *not* covered.
3. Approve the pinned plan.
4. Deploy dark and verify.
5. Enable for a small cohort under synthetic traffic.
6. The exposed cohort shows a request-local latency regression, and the guardrail disables the flag.
7. Propagation is confirmed and recovery verified. The evidence explains the decision.
8. All temporary resources are shown verified gone.
9. Resilience: restart the worker mid-run and show correct recovery.

Second scenario, after the core works: shared connection-pool saturation that degrades both arms. The absolute health limits plus the baseline comparison catch it, and the UI states that attribution is uncertain.

## Success measures (report actual observations, never estimates)
Cleanup success rate, regression-detection delay, false alarm count in calibration runs, time to onboard the demo target.
