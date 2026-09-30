# Glossary

Terms used across Switchyard. Each entry says where it matters here. Add terms as notes introduce them.

## Switchyard domain

| Term | Meaning | Where it matters |
|---|---|---|
| **Release record** | The chain of stored facts: artifact → evidence → approval → observations → decisions | The product's core object ([000](000-system-primer.md)) |
| **Candidate** | An artifact proposed for release, identified by `(registry repository, image digest, platform)` | ADR-0002 |
| **Image digest** | `sha256:…` hash of an image manifest. Immutable, unlike a tag | ADR-0002, goal G2 |
| **Provenance** | Where an artifact came from (such as the source commit), as opposed to what it is | `candidates.source_commit` |
| **Rehearsal** | Running a candidate in an ephemeral project with synthetic fixtures and probes | ADR-0003, #13 |
| **Ephemeral project** | A Railway project created for one rehearsal and deleted after it (`sy-reh-{id}`) | ADR-0003 |
| **Fixture** | Deterministic synthetic data loaded into a rehearsal, versioned by `fixture_version` | #11 |
| **Probe** | A functional check against a running rehearsal (create an order, read it back…). A health endpoint alone never counts as a functional pass | #12 |
| **Evidence bundle** | The sealed, immutable record of a rehearsal: check results, fixture version, config fingerprint, digest, coverage gaps | #15 |
| **Coverage gap** | Something the evidence explicitly does *not* cover. Always present, even as `[]` | Honesty clause |
| **Config fingerprint** | A hash of secret-free service configuration: variable names, plus values only for allowlisted keys | data-model.md |
| **Plan manifest** | What an approval authorizes: target, digest, evidence hash, config fingerprint, policy version, steps, recovery actions, expiry | ADR-0012 |
| **Binding hash** | SHA-256 of the canonical plan manifest. A change to anything bound in it invalidates promotion | ADR-0012, F7 |
| **Dark deploy** | Deploying new code with the controlled flag off. Still ships non-flag changes, so it's verified separately | ADR-0004 |
| **Activation** | Raising the flag's allocation in steps (5% → 25% → …) | health-policy.md |
| **Cohort / arm** | Exposed (flag on) versus control (flag off) groups of assignment units, compared concurrently | ADR-0006 |
| **Assignment unit** | The thing a flag assigns (a user or account). Samples are counted in unique units, not requests | F10, F11 |
| **Exposure event** | An app-emitted event recording which flag value a unit saw. Used to confirm propagation | ADR-0007 |
| **Propagation** | Clients actually picking up a flag change, which is not the same as the write succeeding | ADR-0007 |
| **Guardrail** | A threshold-based operational check. Explicitly *not* a statistical safety proof | ADR-0006 |
| **Emergency limit** | An absolute service-health threshold that stops a rollout regardless of cohort attribution | F17 |
| **Checkpoint** | The end of an observation window, the only point where a decision is made | health-policy.md |
| **Inconclusive** | A verdict that means "not enough fresh evidence to decide". Always stored with its reason | F9–F11 |
| **Janitor** | A scheduled sweep that finds resources past their TTL that aren't verified gone | ADR-0008 |
| **`needs_attention`** | A terminal-ish state that asks a human to act. Never hidden | Cleanup and release lifecycles |

## Reliability and distributed systems

| Term | Meaning | Where it matters |
|---|---|---|
| **Operation intent** | A row recorded *before* an external mutation, with a unique logical key and expected and desired state | ADR-0011, #10 |
| **Logical key** | A deterministic identifier for "this operation", so recording it twice collides instead of duplicating | `UNIQUE (workspace_id, logical_key)` |
| **Idempotency** | Doing something twice has the same effect as doing it once | F3 |
| **Ambiguous outcome** | The call may or may not have taken effect (timeout, 5xx after send). Pause and reconcile; never blindly retry | F4 |
| **Reconciliation** | Reading actual external state and recording it, instead of assuming the result of a call | ADR-0010, ADR-0011 |
| **Source of truth** | The system whose answer wins when records disagree. For Railway state that's the API, not webhooks | ADR-0010 |
| **TOCTOU** | Time-of-check to time-of-use: state can change between reading it and acting on it | RFC-0001 §5.3 |
| **Optimistic concurrency** | Update only `WHERE revision = expected`, and bump the revision. Concurrent writers fail instead of overwriting | data-model.md |
| **Durable execution** | Workflow progress persisted as an event history and replayed after a crash | ADR-0009 |
| **Workflow vs activity** | Temporal workflows orchestrate and must be deterministic. Activities do the I/O and may fail and retry | ADR-0009 |
| **Determinism (Temporal)** | Replaying a workflow's history must reproduce the same decisions, so no direct I/O, randomness or clock reads | ADR-0009 |
| **Signal** | A message sent to a running workflow (for example "a webhook arrived, reconcile now") | ADR-0010 |

## Data and hashing

| Term | Meaning | Where it matters |
|---|---|---|
| **RFC 8785 (JCS)** | JSON Canonicalization Scheme: one byte-exact serialization per JSON value, so equal data hashes equal | #8 |
| **SHA-256** | A cryptographic hash. The same input always gives the same output, and it's infeasible to find two inputs that collide | Evidence and plan hashes |
| **Partial unique index** | A unique index over only the rows matching a `WHERE`, such as one *active* release per target | F15 |
| **Composite foreign key** | An FK over `(workspace_id, id)`, so the database rejects cross-workspace references | data-model.md, principle 1 |
| **Append-only table** | No UPDATE or DELETE grant. History can't be rewritten | `audit_events`, `decisions` |
| **Expand-only migration** | Additive schema change only, so old code still works against the new schema | ADR-0005 |

## Tooling

| Term | Meaning | Where it matters |
|---|---|---|
| **Workspace (pnpm)** | A package inside the monorepo, listed in `pnpm-workspace.yaml` | [001](001-monorepo-scaffold.md) |
| **Phantom dependency** | Importing a package you didn't declare, which only works because of hoisting | [001](001-monorepo-scaffold.md) |
| **Lockfile** | Exact resolved dependency versions. CI installs with `--frozen-lockfile` | [001](001-monorepo-scaffold.md) |
| **Corepack** | A Node tool that runs the package-manager version pinned in `packageManager` | [001](001-monorepo-scaffold.md) |
| **Task graph (Turbo)** | Tasks ordered by package dependencies (`^` means upstream), cached by input hash | [001](001-monorepo-scaffold.md) |
| **Type-aware lint** | ESLint rules that use TypeScript's type information, such as `no-unsafe-return` | [001](001-monorepo-scaffold.md) |
| **Named volume** | Docker-managed storage that outlives containers. Initialized from the image path if that path exists | [005](005-local-dev-environment.md) |
| **Healthcheck** | A command Docker runs to decide whether a service is ready, not just started | [005](005-local-dev-environment.md) |
| **Loopback binding** | Publishing a port on `127.0.0.1` only, so it's unreachable from the network | [005](005-local-dev-environment.md) |
