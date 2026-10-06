CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"release_id" uuid NOT NULL,
	"evidence_bundle_id" uuid NOT NULL,
	"plan_manifest" jsonb NOT NULL,
	"binding_hash" text NOT NULL,
	"actor" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "approvals_binding_hash_check" CHECK ("approvals"."binding_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "approvals_revocation_check" CHECK (("approvals"."revoked_at" IS NULL) = ("approvals"."revoked_reason" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"release_id" uuid,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"operation_intent_id" uuid,
	"details_redacted" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"registry_repository" text NOT NULL,
	"image_digest" text NOT NULL,
	"platform" text NOT NULL,
	"source_commit" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidates_workspace_id_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "candidates_artifact_key" UNIQUE("registry_repository","image_digest","platform"),
	CONSTRAINT "candidates_image_digest_check" CHECK ("candidates"."image_digest" ~ '^sha256:[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "check_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"rehearsal_id" uuid NOT NULL,
	"check_id" text NOT NULL,
	"check_version" text NOT NULL,
	"attempt" integer NOT NULL,
	"result" text,
	"artifact_ref" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "check_runs_attempt_key" UNIQUE("rehearsal_id","check_id","attempt"),
	CONSTRAINT "check_runs_result_check" CHECK (result IN ('pass', 'fail', 'inconclusive', 'error')),
	CONSTRAINT "check_runs_finished_check" CHECK (("check_runs"."result" IS NULL) = ("check_runs"."finished_at" IS NULL)),
	CONSTRAINT "check_runs_attempt_check" CHECK ("check_runs"."attempt" >= 1)
);
--> statement-breakpoint
CREATE TABLE "cleanup_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"rehearsal_id" uuid NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"retries" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"last_error" text,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cleanup_runs_state_check" CHECK (state IN ('pending', 'deleting', 'verifying_absence', 'retrying', 'needs_attention', 'verified_gone')),
	CONSTRAINT "cleanup_runs_retries_check" CHECK ("cleanup_runs"."retries" >= 0),
	CONSTRAINT "cleanup_runs_revision_check" CHECK ("cleanup_runs"."revision" >= 0)
);
--> statement-breakpoint
CREATE TABLE "evidence_bundles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"rehearsal_id" uuid NOT NULL,
	"manifest" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"coverage_gaps" jsonb NOT NULL,
	"sealed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_bundles_workspace_id_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "evidence_bundles_rehearsal_key" UNIQUE("rehearsal_id"),
	CONSTRAINT "evidence_bundles_content_hash_check" CHECK ("evidence_bundles"."content_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "evidence_bundles_coverage_gaps_check" CHECK (jsonb_typeof("evidence_bundles"."coverage_gaps") = 'array')
);
--> statement-breakpoint
CREATE TABLE "operation_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"logical_key" text NOT NULL,
	"operation" text NOT NULL,
	"expected_state" jsonb NOT NULL,
	"desired_state" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"result" jsonb,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operation_intents_workspace_id_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "operation_intents_logical_key" UNIQUE("workspace_id","logical_key"),
	CONSTRAINT "operation_intents_status_check" CHECK (status IN ('pending', 'executing', 'succeeded', 'failed', 'ambiguous')),
	CONSTRAINT "operation_intents_revision_check" CHECK ("operation_intents"."revision" >= 0)
);
--> statement-breakpoint
CREATE TABLE "rehearsals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"release_id" uuid NOT NULL,
	"attempt" integer NOT NULL,
	"fixture_version" text NOT NULL,
	"config_fingerprint" text,
	"railway_project_id" text,
	"state" text DEFAULT 'queued' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"ttl_expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rehearsals_workspace_id_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "rehearsals_release_attempt_key" UNIQUE("release_id","attempt"),
	CONSTRAINT "rehearsals_state_check" CHECK (state IN ('queued', 'provisioning', 'testing', 'paused_ambiguous', 'evidence_sealed', 'failed', 'cancelled')),
	CONSTRAINT "rehearsals_attempt_check" CHECK ("rehearsals"."attempt" >= 1),
	CONSTRAINT "rehearsals_revision_check" CHECK ("rehearsals"."revision" >= 0)
);
--> statement-breakpoint
CREATE TABLE "releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"policy_version" text NOT NULL,
	"state" text DEFAULT 'awaiting_approval' NOT NULL,
	"interruption_reason" text,
	"revision" integer DEFAULT 0 NOT NULL,
	"terminal_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "releases_workspace_id_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "releases_state_check" CHECK (state IN ('awaiting_approval', 'approved', 'deploying_dark', 'verifying_deployment', 'deployment_recovery', 'activating', 'paused', 'disabling', 'confirming_propagation', 'verifying_recovery', 'recovery_verified', 'recovery_failed', 'completed', 'needs_attention')),
	CONSTRAINT "releases_terminal_at_check" CHECK ((state IN ('completed', 'recovery_verified', 'needs_attention')) = ("releases"."terminal_at" IS NOT NULL)),
	CONSTRAINT "releases_revision_check" CHECK ("releases"."revision" >= 0)
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"intent_id" uuid NOT NULL,
	"rehearsal_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"provider_id" text,
	"ownership_name" text NOT NULL,
	"deletion_status" text DEFAULT 'present' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resources_ownership_name_key" UNIQUE("ownership_name"),
	CONSTRAINT "resources_deletion_status_check" CHECK (deletion_status IN ('present', 'deleting', 'verified_gone', 'unknown'))
);
--> statement-breakpoint
CREATE TABLE "targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"railway_project_id" text NOT NULL,
	"railway_environment_id" text NOT NULL,
	"railway_service_id" text NOT NULL,
	"controlled_flag_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "targets_workspace_id_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "targets_railway_service_key" UNIQUE("railway_project_id","railway_environment_id","railway_service_id")
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_release_fk" FOREIGN KEY ("workspace_id","release_id") REFERENCES "public"."releases"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_evidence_bundle_fk" FOREIGN KEY ("workspace_id","evidence_bundle_id") REFERENCES "public"."evidence_bundles"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_release_fk" FOREIGN KEY ("workspace_id","release_id") REFERENCES "public"."releases"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_operation_intent_fk" FOREIGN KEY ("workspace_id","operation_intent_id") REFERENCES "public"."operation_intents"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_runs" ADD CONSTRAINT "check_runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_runs" ADD CONSTRAINT "check_runs_rehearsal_fk" FOREIGN KEY ("workspace_id","rehearsal_id") REFERENCES "public"."rehearsals"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleanup_runs" ADD CONSTRAINT "cleanup_runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleanup_runs" ADD CONSTRAINT "cleanup_runs_rehearsal_fk" FOREIGN KEY ("workspace_id","rehearsal_id") REFERENCES "public"."rehearsals"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_bundles" ADD CONSTRAINT "evidence_bundles_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_bundles" ADD CONSTRAINT "evidence_bundles_rehearsal_fk" FOREIGN KEY ("workspace_id","rehearsal_id") REFERENCES "public"."rehearsals"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation_intents" ADD CONSTRAINT "operation_intents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rehearsals" ADD CONSTRAINT "rehearsals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rehearsals" ADD CONSTRAINT "rehearsals_release_fk" FOREIGN KEY ("workspace_id","release_id") REFERENCES "public"."releases"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_target_fk" FOREIGN KEY ("workspace_id","target_id") REFERENCES "public"."targets"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_candidate_fk" FOREIGN KEY ("workspace_id","candidate_id") REFERENCES "public"."candidates"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_intent_fk" FOREIGN KEY ("workspace_id","intent_id") REFERENCES "public"."operation_intents"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_rehearsal_fk" FOREIGN KEY ("workspace_id","rehearsal_id") REFERENCES "public"."rehearsals"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "targets" ADD CONSTRAINT "targets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "approvals_release_created_idx" ON "approvals" USING btree ("release_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_release_occurred_idx" ON "audit_events" USING btree ("release_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cleanup_runs_one_active_per_rehearsal" ON "cleanup_runs" USING btree ("rehearsal_id") WHERE "cleanup_runs"."state" <> 'verified_gone';--> statement-breakpoint
CREATE UNIQUE INDEX "rehearsals_railway_project_key" ON "rehearsals" USING btree ("railway_project_id") WHERE "rehearsals"."railway_project_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "releases_one_active_per_target" ON "releases" USING btree ("target_id") WHERE "releases"."terminal_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "resources_provider_key" ON "resources" USING btree ("provider_id") WHERE "resources"."provider_id" IS NOT NULL;