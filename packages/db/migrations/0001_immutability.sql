-- Immutability is enforced by triggers, not grants (ADR-0014): grants do not bind the table
-- owner, and the controller connects as the owner on Railway. Every rejection raises SQLSTATE
-- 23000 with the constraint name set, so callers handle it like any other constraint violation.

-- Facts that are never updated or deleted: candidates, audit_events.
CREATE FUNCTION sy_reject_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% on % is not allowed: rows are immutable', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'integrity_constraint_violation', CONSTRAINT = TG_ARGV[0];
END;
$$;
--> statement-breakpoint
CREATE TRIGGER candidates_immutable BEFORE UPDATE OR DELETE ON candidates
  FOR EACH ROW EXECUTE FUNCTION sy_reject_change('candidates_immutable');
--> statement-breakpoint
CREATE TRIGGER candidates_no_truncate BEFORE TRUNCATE ON candidates
  FOR EACH STATEMENT EXECUTE FUNCTION sy_reject_change('candidates_immutable');
--> statement-breakpoint
CREATE TRIGGER audit_events_append_only BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION sy_reject_change('audit_events_append_only');
--> statement-breakpoint
CREATE TRIGGER audit_events_no_truncate BEFORE TRUNCATE ON audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION sy_reject_change('audit_events_append_only');
--> statement-breakpoint

-- Sealed evidence is immutable. An unsealed bundle may still be completed and sealed.
CREATE FUNCTION sy_protect_sealed_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.sealed_at IS NOT NULL THEN
    RAISE EXCEPTION '% on sealed evidence bundle % is not allowed', TG_OP, OLD.id
      USING ERRCODE = 'integrity_constraint_violation', CONSTRAINT = 'evidence_bundles_sealed_immutable';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER evidence_bundles_sealed_immutable BEFORE UPDATE OR DELETE ON evidence_bundles
  FOR EACH ROW EXECUTE FUNCTION sy_protect_sealed_evidence();
--> statement-breakpoint
CREATE TRIGGER evidence_bundles_no_truncate BEFORE TRUNCATE ON evidence_bundles
  FOR EACH STATEMENT EXECUTE FUNCTION sy_reject_change('evidence_bundles_sealed_immutable');
--> statement-breakpoint

-- Approval history is preserved: never deleted, and the only permitted update is a one-time
-- revocation (revoked_at and revoked_reason set from NULL, everything else unchanged).
CREATE FUNCTION sy_protect_approvals() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'approvals are never deleted (approval %)', OLD.id
      USING ERRCODE = 'integrity_constraint_violation', CONSTRAINT = 'approvals_history_preserved';
  END IF;
  IF OLD.revoked_at IS NOT NULL
     OR (to_jsonb(NEW) - 'revoked_at' - 'revoked_reason') <> (to_jsonb(OLD) - 'revoked_at' - 'revoked_reason') THEN
    RAISE EXCEPTION 'approval % may only be revoked once; other columns are immutable', OLD.id
      USING ERRCODE = 'integrity_constraint_violation', CONSTRAINT = 'approvals_history_preserved';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER approvals_history_preserved BEFORE UPDATE OR DELETE ON approvals
  FOR EACH ROW EXECUTE FUNCTION sy_protect_approvals();
--> statement-breakpoint
CREATE TRIGGER approvals_no_truncate BEFORE TRUNCATE ON approvals
  FOR EACH STATEMENT EXECUTE FUNCTION sy_reject_change('approvals_history_preserved');
