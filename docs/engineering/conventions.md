# Engineering conventions

## Work tracking
- **Issue types:** `feature`, `bug`, `spike`, `chore`, `docs`. Templates live in `.github/ISSUE_TEMPLATE/`.
- **Labels:** `type:*`, `area:*` (web, api, worker, domain, db, railway, demo-app, infra, docs), `priority:p0–p2`, `status:blocked`, `status:needs-decision`.
- **Milestones:** M0–M5, as in `docs/plan/roadmap.md`.
- **Project board:** GitHub Projects with columns Backlog → Ready → In progress → In review → Done.
- An issue is **Ready** only when it has acceptance criteria and its dependencies are closed.

## Git
- Trunk-based. `main` is protected and always deployable. Squash merge only.
- Branch: `<type>/<issue>-<slug>`.
- Conventional Commits. The squash title becomes the changelog line.
- Tags: `v0.<milestone>.<patch>` at each milestone exit, for example `v0.1.0` = M1.

## Pull requests
- One issue per PR, linked with `Closes #N`.
- The description covers what changed, why, how it was tested, risks, and doc and ADR impact.
- Self-review before requesting review: read your own diff in the GitHub UI.
- CI must pass: typecheck, lint, unit tests, migration check.

## Testing
- `packages/domain`: exhaustive unit tests of transitions (table-driven), plan hashing and policy evaluation. Target 100% branch coverage there.
- Adapters: contract tests against recorded fixtures, plus opt-in live tests (`LIVE_RAILWAY=1`) that run only against the demo workspace.
- Workflows: Temporal test environment with time skipping for timers; crash-recovery tests per failure mode (F-series).
- The state-machine test DSL renders Mermaid (following Railway's Changesets testing approach), so failing tests can be visualized.

## Documentation
- Docs change in the same PR as behavior.
- Weekly async update: `docs/updates/YYYY-Www.md` covering shipped, next, risks and decisions needed.
- Diagrams are Mermaid in markdown so they're reviewable in diffs.

## Environments
- `local`: docker compose (Postgres, Temporal dev server). See [local-dev.md](local-dev.md).
- `controller` Railway project: web, api, worker, Postgres, Temporal (if self-hosted).
- `demo-orders` Railway project: the supervised target.
- `sy-reh-*` Railway projects: ephemeral, owned by Switchyard, never touched by hand.
