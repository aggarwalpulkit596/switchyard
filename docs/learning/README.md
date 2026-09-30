# Learning notes

Switchyard is a build and also a study. Every issue leaves a note explaining the concepts it needed, the decisions it took, and what happened while doing it, including the mistakes. ADRs record *what* was decided. These notes record *how we got there and what it taught*.

## The four phases

| Phase | Question | Where it shows up |
|---|---|---|
| **Read** | What concepts does this work depend on? | "Read" section: explained from first principles, with sources |
| **Understand** | How do those concepts apply to Switchyard specifically? | "Understand" section: tied to our RFC, ADRs and failure modes |
| **Decide** | What were the options, and why this one? | "Decide" section: options, trade-offs, choice. Constraining decisions also get an ADR |
| **Execute** | What did we do, what broke, and what did that teach? | "Execute" section: real commands and real failures, not a tidied story |

## How to use them

1. Before starting an issue, read the notes for the issues it depends on.
2. Try the "Check yourself" questions before reading the answers in the note.
3. Add your own thoughts under "My notes". Disagreement is welcome; if it changes a decision, it becomes an ADR.
4. New terms go in the [glossary](glossary.md).

## Rules

- **Accuracy over polish.** Every claim is traceable to the repo, a run we did, or a cited source. Uncertainty is stated as uncertainty.
- **Failures are content.** A bug found during execution is written up with its symptom, cause and lesson.
- **One note per issue**, named `NNN-slug.md` after the GitHub issue number. `000` is the system primer.

## Template

```markdown
# NNN: Title

Issue #N · PR #M · Related: ADR-XXXX, RFC §x

## Read
Concepts this work depends on, explained plainly. Link sources.

## Understand
How the concepts apply to Switchyard. Which goals, ADRs or failure modes they serve.

## Decide
| Decision | Options considered | Chosen | Why |
|---|---|---|---|

## Execute
What was done. What broke: symptom → cause → fix → lesson.

## Check yourself
1. Question…

## My notes
```

## Index

| Note | Topic |
|---|---|
| [000](000-system-primer.md) | System primer: the ideas behind Switchyard |
| [001](001-monorepo-scaffold.md) | Monorepo, TypeScript strictness, lint, CI |
| [005](005-local-dev-environment.md) | Containers, Compose, volumes, Temporal dev server |
| [Glossary](glossary.md) | Terms used across the project |
