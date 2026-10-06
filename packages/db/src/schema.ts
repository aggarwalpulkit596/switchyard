// M1 schema. Source of truth for tables, constraints and indexes; see docs/design/data-model.md.
// Invariants live in the database (data model, principle 4). Constraint names are explicit
// because tests and error handling match on them.
// Immutability triggers are not expressible here; they live in a custom migration (ADR-0014).
import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const workspaceId = () =>
  uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id);
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/** Renders `col IN ('a', 'b')` for a state CHECK. Values are compile-time constants, never input. */
const oneOf = (column: string, values: readonly string[]) =>
  sql.raw(`${column} IN (${values.map((v) => `'${v}'`).join(", ")})`);

export const releaseStates = [
  "awaiting_approval",
  "approved",
  "deploying_dark",
  "verifying_deployment",
  "deployment_recovery",
  "activating",
  "paused",
  "disabling",
  "confirming_propagation",
  "verifying_recovery",
  "recovery_verified",
  "recovery_failed",
  "completed",
  "needs_attention",
] as const;
export const terminalReleaseStates = ["completed", "recovery_verified", "needs_attention"] as const;

export const rehearsalStates = [
  "queued",
  "provisioning",
  "testing",
  "paused_ambiguous",
  "evidence_sealed",
  "failed",
  "cancelled",
] as const;

export const checkResults = ["pass", "fail", "inconclusive", "error"] as const;

export const intentStatuses = ["pending", "executing", "succeeded", "failed", "ambiguous"] as const;

export const deletionStatuses = ["present", "deleting", "verified_gone", "unknown"] as const;

export const cleanupStates = [
  "pending",
  "deleting",
  "verifying_absence",
  "retrying",
  "needs_attention",
  "verified_gone",
] as const;

export const workspaces = pgTable("workspaces", {
  id: id(),
  name: text("name").notNull(),
  createdAt: createdAt(),
});

export const targets = pgTable(
  "targets",
  {
    id: id(),
    workspaceId: workspaceId(),
    railwayProjectId: text("railway_project_id").notNull(),
    railwayEnvironmentId: text("railway_environment_id").notNull(),
    railwayServiceId: text("railway_service_id").notNull(),
    controlledFlagKey: text("controlled_flag_key"),
    createdAt: createdAt(),
  },
  (t) => [
    unique("targets_workspace_id_id_key").on(t.workspaceId, t.id),
    unique("targets_railway_service_key").on(
      t.railwayProjectId,
      t.railwayEnvironmentId,
      t.railwayServiceId,
    ),
  ],
);

export const candidates = pgTable(
  "candidates",
  {
    id: id(),
    workspaceId: workspaceId(),
    registryRepository: text("registry_repository").notNull(),
    imageDigest: text("image_digest").notNull(),
    platform: text("platform").notNull(),
    sourceCommit: text("source_commit"),
    createdAt: createdAt(),
  },
  (t) => [
    unique("candidates_workspace_id_id_key").on(t.workspaceId, t.id),
    unique("candidates_artifact_key").on(t.registryRepository, t.imageDigest, t.platform),
    check("candidates_image_digest_check", sql`${t.imageDigest} ~ '^sha256:[0-9a-f]{64}$'`),
  ],
);

export const releases = pgTable(
  "releases",
  {
    id: id(),
    workspaceId: workspaceId(),
    targetId: uuid("target_id").notNull(),
    candidateId: uuid("candidate_id").notNull(),
    policyVersion: text("policy_version").notNull(),
    state: text("state", { enum: releaseStates }).notNull().default("awaiting_approval"),
    interruptionReason: text("interruption_reason"),
    revision: integer("revision").notNull().default(0),
    terminalAt: timestamp("terminal_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    unique("releases_workspace_id_id_key").on(t.workspaceId, t.id),
    foreignKey({
      name: "releases_target_fk",
      columns: [t.workspaceId, t.targetId],
      foreignColumns: [targets.workspaceId, targets.id],
    }),
    foreignKey({
      name: "releases_candidate_fk",
      columns: [t.workspaceId, t.candidateId],
      foreignColumns: [candidates.workspaceId, candidates.id],
    }),
    // F15: one active release per target.
    uniqueIndex("releases_one_active_per_target")
      .on(t.targetId)
      .where(sql`${t.terminalAt} IS NULL`),
    check("releases_state_check", oneOf("state", releaseStates)),
    // terminal_at is set exactly when the state is terminal, so the index above can't be gamed.
    check(
      "releases_terminal_at_check",
      sql`(${oneOf("state", terminalReleaseStates)}) = (${t.terminalAt} IS NOT NULL)`,
    ),
    check("releases_revision_check", sql`${t.revision} >= 0`),
  ],
);

export const rehearsals = pgTable(
  "rehearsals",
  {
    id: id(),
    workspaceId: workspaceId(),
    releaseId: uuid("release_id").notNull(),
    attempt: integer("attempt").notNull(),
    fixtureVersion: text("fixture_version").notNull(),
    configFingerprint: text("config_fingerprint"),
    railwayProjectId: text("railway_project_id"),
    state: text("state", { enum: rehearsalStates }).notNull().default("queued"),
    revision: integer("revision").notNull().default(0),
    ttlExpiresAt: timestamp("ttl_expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique("rehearsals_workspace_id_id_key").on(t.workspaceId, t.id),
    foreignKey({
      name: "rehearsals_release_fk",
      columns: [t.workspaceId, t.releaseId],
      foreignColumns: [releases.workspaceId, releases.id],
    }),
    unique("rehearsals_release_attempt_key").on(t.releaseId, t.attempt),
    uniqueIndex("rehearsals_railway_project_key")
      .on(t.railwayProjectId)
      .where(sql`${t.railwayProjectId} IS NOT NULL`),
    check("rehearsals_state_check", oneOf("state", rehearsalStates)),
    check("rehearsals_attempt_check", sql`${t.attempt} >= 1`),
    check("rehearsals_revision_check", sql`${t.revision} >= 0`),
  ],
);

export const checkRuns = pgTable(
  "check_runs",
  {
    id: id(),
    workspaceId: workspaceId(),
    rehearsalId: uuid("rehearsal_id").notNull(),
    checkId: text("check_id").notNull(),
    checkVersion: text("check_version").notNull(),
    attempt: integer("attempt").notNull(),
    result: text("result", { enum: checkResults }),
    artifactRef: text("artifact_ref"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: "check_runs_rehearsal_fk",
      columns: [t.workspaceId, t.rehearsalId],
      foreignColumns: [rehearsals.workspaceId, rehearsals.id],
    }),
    unique("check_runs_attempt_key").on(t.rehearsalId, t.checkId, t.attempt),
    check("check_runs_result_check", oneOf("result", checkResults)),
    // A run has a result exactly when it has finished.
    check("check_runs_finished_check", sql`(${t.result} IS NULL) = (${t.finishedAt} IS NULL)`),
    check("check_runs_attempt_check", sql`${t.attempt} >= 1`),
  ],
);

export const evidenceBundles = pgTable(
  "evidence_bundles",
  {
    id: id(),
    workspaceId: workspaceId(),
    rehearsalId: uuid("rehearsal_id").notNull(),
    manifest: jsonb("manifest").notNull(),
    contentHash: text("content_hash").notNull(),
    coverageGaps: jsonb("coverage_gaps").notNull(),
    sealedAt: timestamp("sealed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    unique("evidence_bundles_workspace_id_id_key").on(t.workspaceId, t.id),
    foreignKey({
      name: "evidence_bundles_rehearsal_fk",
      columns: [t.workspaceId, t.rehearsalId],
      foreignColumns: [rehearsals.workspaceId, rehearsals.id],
    }),
    unique("evidence_bundles_rehearsal_key").on(t.rehearsalId),
    check("evidence_bundles_content_hash_check", sql`${t.contentHash} ~ '^[0-9a-f]{64}$'`),
    // Coverage gaps are always stated, even when empty (#15).
    check("evidence_bundles_coverage_gaps_check", sql`jsonb_typeof(${t.coverageGaps}) = 'array'`),
  ],
);

export const approvals = pgTable(
  "approvals",
  {
    id: id(),
    workspaceId: workspaceId(),
    releaseId: uuid("release_id").notNull(),
    evidenceBundleId: uuid("evidence_bundle_id").notNull(),
    planManifest: jsonb("plan_manifest").notNull(),
    bindingHash: text("binding_hash").notNull(),
    actor: text("actor").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedReason: text("revoked_reason"),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: "approvals_release_fk",
      columns: [t.workspaceId, t.releaseId],
      foreignColumns: [releases.workspaceId, releases.id],
    }),
    foreignKey({
      name: "approvals_evidence_bundle_fk",
      columns: [t.workspaceId, t.evidenceBundleId],
      foreignColumns: [evidenceBundles.workspaceId, evidenceBundles.id],
    }),
    index("approvals_release_created_idx").on(t.releaseId, t.createdAt),
    check("approvals_binding_hash_check", sql`${t.bindingHash} ~ '^[0-9a-f]{64}$'`),
    check(
      "approvals_revocation_check",
      sql`(${t.revokedAt} IS NULL) = (${t.revokedReason} IS NULL)`,
    ),
  ],
);

export const operationIntents = pgTable(
  "operation_intents",
  {
    id: id(),
    workspaceId: workspaceId(),
    logicalKey: text("logical_key").notNull(),
    operation: text("operation").notNull(),
    expectedState: jsonb("expected_state").notNull(),
    desiredState: jsonb("desired_state").notNull(),
    status: text("status", { enum: intentStatuses }).notNull().default("pending"),
    result: jsonb("result"),
    revision: integer("revision").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    unique("operation_intents_workspace_id_id_key").on(t.workspaceId, t.id),
    // Idempotent intent creation (ADR-0011).
    unique("operation_intents_logical_key").on(t.workspaceId, t.logicalKey),
    check("operation_intents_status_check", oneOf("status", intentStatuses)),
    check("operation_intents_revision_check", sql`${t.revision} >= 0`),
  ],
);

export const resources = pgTable(
  "resources",
  {
    id: id(),
    workspaceId: workspaceId(),
    intentId: uuid("intent_id").notNull(),
    rehearsalId: uuid("rehearsal_id").notNull(),
    kind: text("kind").notNull(),
    providerId: text("provider_id"),
    ownershipName: text("ownership_name").notNull(),
    deletionStatus: text("deletion_status", { enum: deletionStatuses })
      .notNull()
      .default("present"),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: "resources_intent_fk",
      columns: [t.workspaceId, t.intentId],
      foreignColumns: [operationIntents.workspaceId, operationIntents.id],
    }),
    foreignKey({
      name: "resources_rehearsal_fk",
      columns: [t.workspaceId, t.rehearsalId],
      foreignColumns: [rehearsals.workspaceId, rehearsals.id],
    }),
    uniqueIndex("resources_provider_key")
      .on(t.providerId)
      .where(sql`${t.providerId} IS NOT NULL`),
    unique("resources_ownership_name_key").on(t.ownershipName),
    check("resources_deletion_status_check", oneOf("deletion_status", deletionStatuses)),
  ],
);

export const cleanupRuns = pgTable(
  "cleanup_runs",
  {
    id: id(),
    workspaceId: workspaceId(),
    rehearsalId: uuid("rehearsal_id").notNull(),
    state: text("state", { enum: cleanupStates }).notNull().default("pending"),
    retries: integer("retries").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    lastError: text("last_error"),
    revision: integer("revision").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: "cleanup_runs_rehearsal_fk",
      columns: [t.workspaceId, t.rehearsalId],
      foreignColumns: [rehearsals.workspaceId, rehearsals.id],
    }),
    // One active cleanup per rehearsal. needs_attention stays active on purpose (goal G4).
    uniqueIndex("cleanup_runs_one_active_per_rehearsal")
      .on(t.rehearsalId)
      .where(sql`${t.state} <> 'verified_gone'`),
    check("cleanup_runs_state_check", oneOf("state", cleanupStates)),
    check("cleanup_runs_retries_check", sql`${t.retries} >= 0`),
    check("cleanup_runs_revision_check", sql`${t.revision} >= 0`),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: id(),
    workspaceId: workspaceId(),
    releaseId: uuid("release_id"),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    operationIntentId: uuid("operation_intent_id"),
    detailsRedacted: jsonb("details_redacted").notNull().default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "audit_events_release_fk",
      columns: [t.workspaceId, t.releaseId],
      foreignColumns: [releases.workspaceId, releases.id],
    }),
    foreignKey({
      name: "audit_events_operation_intent_fk",
      columns: [t.workspaceId, t.operationIntentId],
      foreignColumns: [operationIntents.workspaceId, operationIntents.id],
    }),
    index("audit_events_release_occurred_idx").on(t.releaseId, t.occurredAt),
  ],
);
