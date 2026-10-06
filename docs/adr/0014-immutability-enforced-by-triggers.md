# ADR-0014: Immutability enforced by triggers, not grants

- **Status:** Accepted
- **Date:** 2026-10-06
- **Deciders:** Pulkit
- **Related:** #6, data-model.md (principles 2 and 5), ADR-0012

## Context
The data model said candidates and decisions have "no UPDATE grant" and audit events are append-only. Postgres privileges don't apply to a table's owner or to superusers. On Railway the controller connects with the database's default credentials, which own the tables. A grant-only rule would therefore enforce nothing in production, while still looking enforced on paper.

## Decision
Immutability is enforced by `BEFORE` triggers that raise an error, defined in a custom migration (`packages/db/migrations/0001_immutability.sql`):

| Table | Rejected |
|---|---|
| `candidates` | UPDATE, DELETE, TRUNCATE |
| `audit_events` | UPDATE, DELETE, TRUNCATE |
| `evidence_bundles` | UPDATE and DELETE once `sealed_at` is set; TRUNCATE |
| `approvals` | DELETE, TRUNCATE, and any UPDATE other than a one-time revocation (`revoked_at` and `revoked_reason` set from NULL) |

Each rejection raises SQLSTATE `23000` (`integrity_constraint_violation`) with the constraint name set to the trigger's name. Callers handle it the same way as a unique or check violation. `TRUNCATE` gets its own statement-level trigger, because row-level triggers don't fire for it. Later append-only tables (`decisions` in M4) follow the same pattern.

## Consequences
- Enforcement holds for every role that doesn't disable triggers, including the owner the app connects as.
- A superuser can still `ALTER TABLE … DISABLE TRIGGER` or drop the trigger. This is tamper-*resistance* against bugs and mistakes, not tamper-*proofing* against a malicious administrator. The UI and docs must not claim more.
- Every new immutable table needs a trigger and a test proving it rejects each operation.
- Test fixtures can't clean up these tables with statements the triggers reject. Tests run in rolled-back transactions against a throwaway database instead.

## Alternatives considered
- **Grants and a restricted app role:** correct only if the app never connects as the owner. On Railway that's an extra role and connection string to manage, and it fails open if someone uses the default URL.
- **Both triggers and a restricted role:** stronger defence in depth, but more setup than v1 needs. Can be added later without changing this decision.
- **Application-level checks only:** any code path, script or manual query bypasses them (data model, principle 4).
