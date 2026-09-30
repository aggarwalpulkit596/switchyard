# 001: Monorepo scaffold

Issue #1 · PR #21 · Related: ADR-0013, [conventions](../engineering/conventions.md)

## Read

**Monorepo.** One repository holding several deployable apps and shared libraries. The benefit for us is shared types: the GraphQL API, the worker and the UI all import the same domain types, so a change to a state name breaks the build everywhere at once instead of drifting silently. The cost is tooling: something must know which package depends on which.

**pnpm workspaces.** `pnpm-workspace.yaml` lists the package folders (`apps/*`, `packages/*`). pnpm stores every dependency once in a content-addressed store and symlinks it into each package's `node_modules`. It is *strict*: a package can only import what it declares. npm and Yarn classic hoist everything to the root, so an undeclared import often works by accident (a "phantom dependency").

**Lockfile.** `pnpm-lock.yaml` records the exact resolved version of every dependency. `pnpm install --frozen-lockfile` (what CI runs) fails if `package.json` and the lockfile disagree, so CI tests exactly what you tested locally.

**Corepack and `packageManager`.** `"packageManager": "pnpm@10.11.0"` pins the package manager itself. Corepack ships with Node 24 (our local version), reads that field, and runs that exact version. Node.js has announced plans to stop bundling Corepack in future major versions, so this may later need a standalone install.

**Turborepo.** It runs a task (`typecheck`, `lint`, `test`) in every package that defines it, in dependency order. `"dependsOn": ["^build"]` means "build my dependencies first"; the `^` refers to upstream packages. Turbo hashes each task's inputs and skips work whose inputs haven't changed. `>>> FULL TURBO` means every task came from cache.

**TypeScript strictness.** `strict` turns on the core safety checks (`strictNullChecks`, `noImplicitAny`…). We added more:
- `noUncheckedIndexedAccess`: `xs[0]` has type `T | undefined`, because arrays can be empty.
- `exactOptionalPropertyTypes`: `{ a?: string }` means "absent or string", not "may be explicitly `undefined`". This matters when absence and `undefined` mean different things, as with a JSON manifest we hash.
- `verbatimModuleSyntax`: type-only imports must say `import type`, so the emitted JS is predictable.

**Lint vs format vs typecheck.** Three different jobs:
- The type checker proves type consistency.
- ESLint finds risky patterns. The `strictTypeChecked` preset uses type information to catch things like an unsafe `any` flowing into a return value.
- Prettier only decides layout. `eslint-config-prettier` switches off ESLint's style rules so the two never fight.

## Understand

`packages/domain` must be pure and exhaustively tested (CLAUDE.md). Strict types plus type-aware lint make most "forgot the undefined case" bugs compile errors, which is cheaper than a failure-mode test finding them later. The monorepo layout from the README is now real, with empty packages, so each future issue lands in a known place.

## Decide

| Decision | Options | Chosen | Why |
|---|---|---|---|
| TypeScript version | 7.0 (npm `latest`) · 6.0 | `~6.0.3` | typescript-eslint 8.71 declares `typescript >=4.8.4 <6.1.0`. Newest isn't best if the toolchain around it can't parse it yet |
| ESLint version | 9 · 10 | 10 | pnpm reported eslint 9 as deprecated at install time |
| Tests in empty packages | Placeholder tests · `--passWithNoTests` | `--passWithNoTests` | A test of nothing is noise. Real tests arrive with real code |
| `db:migrate` before any schema | Omit · stub | Stub that prints and exits 0 | CI already calls it; the stub keeps the pipeline shape stable until #6 |
| Prettier scope | Everything · code only | Code and config | Reformatting hand-written docs would bury the scaffold in unrelated diff |
| Turbo's `AGENTS.md` | Keep · opt out | `agentGuidance: false` | CLAUDE.md is already the agent manual; two would drift |

## Execute

**Proving the gates work.** A check that never fails proves nothing, so we planted violations:
- `const first: number = xs[0]` → `TS2322: 'number | undefined' is not assignable to 'number'`
- `function f(a: any) { return a }` → `no-explicit-any` and `no-unsafe-return`

Both failed as intended and were reverted. This is the same idea as "failure-path test for every external call" in the Definition of done: test the test.

**Break 1: `pnpm` not on PATH.**
- *Symptom:* `corepack pnpm install` worked, but `pnpm typecheck` failed with Turbo's `Unable to find package manager binary`.
- *Cause:* Turbo spawns `pnpm` itself and looks it up on PATH. Invoking through `corepack pnpm` didn't put a `pnpm` binary there.
- *Fix:* `corepack enable` installs the shims.
- *Lesson:* tools that orchestrate other tools need them on PATH, not just invocable.

**Break 2: CI failed in 0 seconds, on every run, including `main`.**
- *Symptom:* "This run likely failed because of a workflow file issue."
- *Cause:* `if: hashFiles('pnpm-lock.yaml') != ''` at *job* level. GitHub's expression docs allow `hashFiles()` only in step-level contexts, so the whole file was rejected. Our reading of *why*: `hashFiles()` reads files from the checked-out workspace, and no workspace exists yet when job conditions are evaluated.
- *Fix:* remove the guard; the lockfile now exists.
- *Lesson:* a CI that has never been green is not a safety net. Check the first run, not just the config.

## Check yourself
1. What is a phantom dependency, and why does pnpm's layout prevent it?
2. With `noUncheckedIndexedAccess`, what's the type of `record[k]` for a `Record<string, number>`, and why?
3. Why run Prettier and ESLint as separate tools rather than one?
4. What does `"dependsOn": ["^typecheck"]` do, and when would you drop the `^`?
5. Why is "newest version" the wrong default for TypeScript here?
6. How would you prove a lint rule is actually enforced in CI?

## My notes
