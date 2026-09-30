# Roadmap

Dates are **planning estimates**, not commitments; revisit them in the weekly update. Each milestone has exit criteria that are demonstrable, not just "code merged".

| Milestone | Target | Theme | Exit criteria |
|---|---|---|---|
| **M0: Foundations & spike** | Oct 1 – Oct 5 | Verify the platform; repo, CI, tooling | Spike 001 answered; ADR-0002/0009/0013 accepted or superseded; CI green on an empty monorepo |
| **M1: Rehearsal & evidence** ⭐ | Oct 6 – Oct 19 | Vertical slice | Pick a digest → ephemeral project → fixtures → probes → sealed evidence → plan-bound approval → cleanup **verified gone**. Survives a worker restart mid-provisioning. Deployed on Railway. |
| **M2: Dark deploy** | Oct 20 – Oct 26 | Production deploy by digest | Deploy the approved digest dark; verification; recovery to the previous digest; webhook inbox plus polling reconciliation |
| **M3: Activation** | Oct 27 – Nov 2 | Flag-controlled exposure | Stepwise allocation via the flag adapter; live cohort metrics; manual pause and disable; conflict detection |
| **M4: Guardrails & recovery** | Nov 3 – Nov 9 | Automation | Automatic decisions at checkpoints; propagation confirmation; recovery verification; stale approval rejection; F9–F14 tests |
| **M5: Polish & proof** | Nov 10 – Nov 16 | Demo quality | Usability pass, demo video, write-up, measured results, second scenario (shared degradation) |

⭐ **Application trigger:** apply to Railway when M1's exit criteria are met, with the demo and a clear M2–M4 plan. Don't wait for M5.

## Out of scope for v1
See `../product/brief.md#non-goals-v1`.
