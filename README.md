# Switchyard

> Switchyard binds release approval to a tested artifact and its evidence, then supervises deployment and feature activation on Railway.

**Status:** pre-alpha · design phase · Milestone M0 (platform verification spike)

## The problem

A developer maintaining a small Railway app deploys, opens logs, clicks through a few flows, and hopes nothing broke. The deploy is automated. The judgement isn't recorded anywhere, so nobody can say later what was tested, who approved it, or why the rollout continued.

## What Switchyard does

1. **Pin** a candidate by image digest. The source commit is kept as provenance.
2. **Rehearse** it in an ephemeral Railway project with synthetic fixtures and functional probes.
3. **Seal** the results into an immutable evidence bundle that states its coverage gaps.
4. **Approve** a specific plan: this digest, this evidence, this policy, these steps.
5. **Deploy dark**, meaning the feature flag is off, and verify the deployment on its own.
6. **Activate gradually** behind a Railway feature flag, comparing cohorts with explicit sample counts.
7. **Recover**: disable the flag, confirm clients picked up the change, then verify the metric recovers.
8. **Clean up** in an independent lifecycle that reports every leftover resource.

The central object is the **release record** that connects artifact, evidence, approval, observations and decisions.

## Documentation

| Doc | Purpose |
|---|---|
| [Product brief](docs/product/brief.md) | User, scope, non-goals, demo |
| [RFC-0001](docs/design/rfc-0001-switchyard.md) | Architecture and core protocols |
| [Data model](docs/design/data-model.md) | ERD, constraints, invariants |
| [State machines](docs/design/state-machines.md) | Rehearsal, release and cleanup lifecycles |
| [Failure modes](docs/design/failure-modes.md) | Expected behavior under failure |
| [Health policy](docs/design/health-policy.md) | How promotion decisions are made |
| [ADRs](docs/adr/) | Locked decisions and their reasons |
| [Spike 001](docs/spikes/spike-001-platform-verification.md) | Platform assumptions to verify first |
| [Roadmap](docs/plan/roadmap.md) | Milestones and exit criteria |
| [Engineering conventions](docs/engineering/conventions.md) | Branching, commits, testing, reviews |

## Repository layout (target)

```
apps/
  web/            React UI: release review, live progress, evidence
  api/            TypeScript GraphQL API
  worker/         Temporal workflows and activities
  demo-orders/    Sample order-management app (the rehearsal target)
  probe-runner/   Functional probes, runs with limited credentials
packages/
  domain/         Pure state machines, policy evaluation, plan hashing
  db/             Schema, SQL migrations, typed queries
  railway/        Railway GraphQL adapter plus flag adapter (isolated dependency)
docs/             Design, ADRs, spikes, plans, weekly updates
backlog/          Issue sources, synced to GitHub by scripts/bootstrap-github.sh
```

## Development

Requires Node 22.12+ and pnpm (pinned via `packageManager`; `corepack enable` installs it).

```
cp .env.example .env
docker compose up -d --wait
pnpm install
pnpm typecheck && pnpm lint && pnpm test
pnpm format:check
```

See [local development](docs/engineering/local-dev.md) for details.

## Honesty clause

Switchyard applies **operational guardrails**. It is not a statistical safety engine. "Thresholds passed" does not mean "proven safe". Turning a flag off does not undo database writes, migrations, emails or payments. The UI and docs say so.
