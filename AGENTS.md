# AGENTS.md: operating manual for AI-assisted work in this repo

This project is run the way a small remote engineering team runs work: written first, asynchronous, and traceable. Every change maps to an issue, every decision is recorded, and every PR can be reviewed without anyone having to explain it live.

## Before you start any task

1. Read `README.md`, `docs/design/rfc-0001-switchyard.md` and the ADRs relevant to the area you're touching.
2. Find the GitHub issue for the task. If there isn't one, stop and propose one using the matching template in `.github/ISSUE_TEMPLATE/`.
3. Restate the acceptance criteria and write a short plan before editing code.

## Workflow per issue

- Branch: `<type>/<issue-number>-<slug>`, for example `feat/12-rehearsal-project-provisioning`.
- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`), each referencing the issue (`Refs #12`).
- PR: use `.github/pull_request_template.md`. One issue per PR. Keep PRs reviewable, ideally under ~400 changed lines excluding generated code.
- Close issues with `Closes #N` in the PR body, never by hand.

## Decisions

- A decision that constrains future work (library choice, data model shape, protocol, trust boundary) needs an ADR in `docs/adr/`, numbered sequentially and using `0000-template.md`.
- Never silently contradict an accepted ADR. Supersede it with a new ADR and link the two.
- If a design doc and the code disagree, fix one of them in the same PR.

## Hard rules

- **No secrets in git.** Tokens live in `.env` (gitignored) and Railway variables. Redact tokens, headers and connection strings from logs, fixtures and evidence.
- **Railway mutations are dangerous.** Only touch the dedicated demo workspace. Never delete a resource that isn't recorded in the `resources` ledger. Ask the human before running anything that creates or deletes real infrastructure outside tests.
- **Webhooks are hints, not truth.** Never start a mutation directly from a webhook. Wake the workflow and reconcile against the API. See ADR-0010.
- **External mutations go through `operation_intents`.** Record the intent, execute, then reconcile. If the result is ambiguous (a timeout, say), pause. Never retry blindly. See ADR-0011.
- **Domain logic stays pure.** State transitions, policy evaluation and plan hashing live in `packages/domain`, have no I/O, and are unit-tested exhaustively.
- **Don't overclaim.** UI copy and docs must not say a release is "safe", an incident is "resolved", or cleanup "succeeded" unless evidence supports it.

## Definition of done

- [ ] Acceptance criteria in the issue are met and demonstrated (test output, screenshot or log).
- [ ] Unit tests cover the logic, and a failure-path test exists for every new external call.
- [ ] Types check, lint passes, and CI is green.
- [ ] Docs updated: RFC, data model, state machines or failure modes if behavior changed.
- [ ] ADR added if a decision was made.
- [ ] `CHANGELOG.md` updated under `Unreleased`.

## Communication

- Record status on the issue (what changed, what's blocked, what's next), not only in chat.
- At the end of each week, draft `docs/updates/YYYY-Www.md` from the template.
- When uncertain about a platform behavior, write it down as an open question in the relevant spike doc instead of guessing.
