# Claude Code kickoff prompts

Use these in order. Each prompt is one working session that ends with a PR. Start every session with `/clear` so context stays focused; CLAUDE.md is loaded automatically.

## Session 0: repo bootstrap (once)
```
Read CLAUDE.md, README.md and everything under docs/. Summarize the product,
the locked decisions (ADRs) and the M0/M1 plan in under 200 words so I can
confirm you understood. Then run scripts/bootstrap-github.sh (I'm already
authenticated with gh) and report what was created. Do not write product code yet.
```

## Session 1: issue #001 scaffold
```
Work on the GitHub issue titled "chore: Monorepo scaffold". Follow CLAUDE.md
exactly: restate acceptance criteria, propose a plan, wait for my OK, then
implement on branch chore/<n>-monorepo-scaffold, open a PR using the template.
```

## Session 2+: spikes (#002–#004)
```
Work on the spike issue "<title>". For each question, write a minimal script
in spikes/001/, run it ONLY against the demo workspace in .env, record the
answer (✅/❌/⚠️ with evidence) in docs/spikes/spike-001-platform-verification.md,
and update affected ADR statuses. Ask me before any create/delete call.
Stop at the timebox and summarize what is still unknown.
```

## Generic feature session
```
Work on issue #<n>. Read the linked docs and ADRs first. Restate acceptance
criteria and failure modes covered, propose a plan with the tests you'll
write first, wait for my OK, implement, update docs/CHANGELOG, open the PR.
```

## End of week
```
Draft docs/updates/<YYYY-Www>.md from the template using merged PRs,
closed issues and open blockers this week. Actual observations only.
```
