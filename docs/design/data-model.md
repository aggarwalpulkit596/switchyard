# Data model

Status: Draft v0.1. The M1 subset is marked **[M1]**; the rest lands in later milestones.

## Principles
1. **Every row belongs to a workspace.** Foreign keys are composite `(workspace_id, id)`, so the database itself rejects cross-workspace references.
2. **Facts are immutable, state is explicit.** Candidates, sealed evidence, decisions and audit events are never updated. Lifecycle rows carry a `state` plus a `revision` integer for optimistic concurrency.
3. **External reality is recorded, not assumed.** `operation_intents` and `resources` capture what was attempted and what exists.
4. **Uniqueness enforces invariants.** Wherever possible, invariants are unique or partial-unique indexes, not application checks.

## ERD

```mermaid
erDiagram
  workspaces ||--o{ targets : owns
  workspaces ||--o{ candidates : owns
  targets ||--o{ releases : "has"
  candidates ||--o{ releases : "is shipped by"
  releases ||--o{ rehearsals : "rehearsed by"
  rehearsals ||--o{ check_runs : runs
  rehearsals ||--o| evidence_bundles : seals
  releases ||--o{ approvals : "authorized by"
  evidence_bundles ||--o{ approvals : "bound into"
  releases ||--o{ deployment_attempts : "deployed by"
  releases ||--o{ activation_steps : "activated by"
  releases ||--o{ observation_windows : "observed in"
  observation_windows ||--o{ decisions : "evaluated by"
  operation_intents ||--o{ resources : "creates"
  rehearsals ||--o{ resources : owns
  rehearsals ||--o{ cleanup_runs : "cleaned by"
  releases ||--o{ audit_events : "logged in"

  targets {
    uuid id PK
    uuid workspace_id FK
    text railway_project_id
    text railway_environment_id
    text railway_service_id
    text controlled_flag_key
    timestamptz created_at
  }
  candidates {
    uuid id PK
    uuid workspace_id FK
    text registry_repository
    text image_digest "sha256:..."
    text platform "linux/amd64"
    text source_commit "provenance only"
    timestamptz created_at
  }
  releases {
    uuid id PK
    uuid workspace_id FK
    uuid target_id FK
    uuid candidate_id FK
    text policy_version
    text state
    text interruption_reason
    int revision
    timestamptz terminal_at
  }
  rehearsals {
    uuid id PK
    uuid release_id FK
    int attempt
    text fixture_version
    text config_fingerprint
    text railway_project_id "ephemeral"
    text state
    timestamptz ttl_expires_at
  }
  check_runs {
    uuid id PK
    uuid rehearsal_id FK
    text check_id
    text check_version
    int attempt
    text result "pass|fail|inconclusive|error"
    text artifact_ref
    timestamptz started_at
    timestamptz finished_at
  }
  evidence_bundles {
    uuid id PK
    uuid rehearsal_id FK
    jsonb manifest
    text content_hash
    jsonb coverage_gaps
    timestamptz sealed_at
  }
  approvals {
    uuid id PK
    uuid release_id FK
    uuid evidence_bundle_id FK
    jsonb plan_manifest
    text binding_hash
    text actor
    timestamptz expires_at
    timestamptz revoked_at
    text revoked_reason
  }
  deployment_attempts {
    uuid id PK
    uuid release_id FK
    int attempt
    text candidate_digest
    text previous_digest
    text provider_deployment_id
    text state
  }
  activation_steps {
    uuid id PK
    uuid release_id FK
    int sequence
    numeric intended_allocation
    text observed_flag_fingerprint
    text state
  }
  observation_windows {
    uuid id PK
    uuid release_id FK
    text phase "dark|step:n|recovery"
    timestamptz starts_at
    timestamptz ends_at
    text freshness "fresh|stale|unknown"
    jsonb cohort_counts
    jsonb metric_summaries
  }
  decisions {
    uuid id PK
    uuid window_id FK
    text policy_version
    text verdict "advance|hold|inconclusive|stop|emergency_stop"
    text explanation
    jsonb evidence_refs
    timestamptz decided_at
  }
  operation_intents {
    uuid id PK
    uuid workspace_id FK
    text logical_key
    text operation
    jsonb expected_state
    jsonb desired_state
    text status "pending|executing|succeeded|failed|ambiguous"
    jsonb result
  }
  resources {
    uuid id PK
    uuid intent_id FK
    uuid rehearsal_id FK
    text kind
    text provider_id
    text ownership_name
    text deletion_status "present|deleting|verified_gone|unknown"
  }
  cleanup_runs {
    uuid id PK
    uuid rehearsal_id FK
    text state
    int retries
    timestamptz next_attempt_at
    text last_error
  }
  webhook_inbox {
    uuid id PK
    text payload_hash
    text event_type
    text provider_resource_id
    jsonb payload
    timestamptz received_at
    text processing_status
  }
  audit_events {
    uuid id PK
    uuid workspace_id FK
    uuid release_id FK
    text actor
    text action
    uuid operation_intent_id
    jsonb details_redacted
    timestamptz occurred_at
  }
```

## Constraints and indexes

| Table | Constraint / index | Invariant it enforces |
|---|---|---|
| `targets` [M1] | `UNIQUE (railway_project_id, railway_environment_id, railway_service_id)` | One target per external service |
| `candidates` [M1] | `UNIQUE (registry_repository, image_digest, platform)`; no UPDATE grant | Artifact identity is immutable |
| `releases` [M1] | `UNIQUE (target_id) WHERE terminal_at IS NULL` | One active release per target |
| `rehearsals` [M1] | `UNIQUE (release_id, attempt)`; `UNIQUE (railway_project_id) WHERE railway_project_id IS NOT NULL` | Attempts are ordered; ephemeral project owned once |
| `check_runs` [M1] | `UNIQUE (rehearsal_id, check_id, attempt)` | Retries are explicit, not overwrites |
| `evidence_bundles` [M1] | `UNIQUE (rehearsal_id)`; trigger blocks UPDATE when `sealed_at IS NOT NULL` | Sealed evidence is immutable |
| `approvals` [M1] | `INDEX (release_id, created_at)`; rows are never deleted | Approval history preserved |
| `deployment_attempts` | `UNIQUE (release_id, attempt)` | Dark deploy retries are explicit |
| `activation_steps` | `UNIQUE (release_id, sequence)` | Exposure steps ordered |
| `observation_windows` | `UNIQUE (release_id, phase, starts_at)`; `INDEX (release_id, starts_at)` | No overlapping duplicate windows |
| `decisions` | Append-only (no UPDATE or DELETE grant) | Explanations cannot be rewritten |
| `operation_intents` [M1] | `UNIQUE (workspace_id, logical_key)` | Idempotent intent creation |
| `resources` [M1] | `UNIQUE (provider_id) WHERE provider_id IS NOT NULL`; `UNIQUE (ownership_name)` | No double-owned provider resource |
| `cleanup_runs` [M1] | `UNIQUE (rehearsal_id) WHERE state NOT IN ('verified_gone','abandoned')` | One active cleanup per rehearsal |
| `webhook_inbox` | `UNIQUE (payload_hash)`; `INDEX (processing_status, received_at)`; 30-day retention | Duplicate deliveries deduplicated |
| `audit_events` [M1] | Append-only; `INDEX (release_id, occurred_at)` | Tamper-evident history |

## Canonical hashes
- `evidence_bundles.content_hash` = SHA-256 over the RFC 8785 canonical JSON of the manifest (check results, fixture version, config fingerprint, candidate digest, coverage gaps).
- `approvals.binding_hash` = SHA-256 over the canonical plan manifest (RFC-0001 §5.4).
- `config_fingerprint` = SHA-256 over the canonical, **secret-free** service configuration. Variable *names* are included; values are only included for an allowlist of non-secret keys.

## Open points
- Store raw probe artifacts (logs, HAR files) in a Railway bucket and reference them via `artifact_ref`, or inline them? Default: bucket plus hash.
- Retention for `observation_windows.metric_summaries` once telemetry volume is measured.
