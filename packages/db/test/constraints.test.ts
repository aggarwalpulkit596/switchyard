// One block per [M1] row of the constraints table in docs/design/data-model.md. Every
// rejection is asserted by SQLSTATE and constraint name, so a test can't pass on the wrong error.
import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as s from "../src/schema.js";
import * as f from "./factories.js";
import { digest, expectViolation, one, SQLSTATE, sha, withRollback } from "./helpers.js";

describe("workspace isolation (principle 1)", () => {
  it("rejects a release whose target belongs to another workspace", () =>
    withRollback(async (tx) => {
      const a = await f.workspace(tx);
      const b = await f.workspace(tx);
      const foreignTarget = await f.target(tx, a.id);
      await expectViolation(f.release(tx, b.id, { targetId: foreignTarget.id }), {
        code: SQLSTATE.foreignKey,
        constraint: "releases_target_fk",
      });
    }));
});

describe("targets: one target per external service", () => {
  it("rejects a second target for the same project, environment and service", () =>
    withRollback(async (tx) => {
      const ws = await f.workspace(tx);
      const first = await f.target(tx, ws.id);
      await expectViolation(f.target(tx, ws.id, { railwayProjectId: first.railwayProjectId }), {
        code: SQLSTATE.unique,
        constraint: "targets_railway_service_key",
      });
    }));
});

describe("candidates: artifact identity is immutable", () => {
  it("rejects a duplicate (repository, digest, platform)", () =>
    withRollback(async (tx) => {
      const ws = await f.workspace(tx);
      const c = await f.candidate(tx, ws.id);
      await expectViolation(f.candidate(tx, ws.id, { registryRepository: c.registryRepository }), {
        code: SQLSTATE.unique,
        constraint: "candidates_artifact_key",
      });
    }));

  it("rejects a digest that is not sha256", () =>
    withRollback(async (tx) => {
      const ws = await f.workspace(tx);
      await expectViolation(f.candidate(tx, ws.id, { imageDigest: "latest" }), {
        code: SQLSTATE.check,
        constraint: "candidates_image_digest_check",
      });
    }));

  it("rejects UPDATE and DELETE", () =>
    withRollback(async (tx, client) => {
      const ws = await f.workspace(tx);
      const c = await f.candidate(tx, ws.id);
      await client.query("SAVEPOINT before_update");
      await expectViolation(
        tx
          .update(s.candidates)
          .set({ imageDigest: digest("b") })
          .where(eq(s.candidates.id, c.id)),
        { code: SQLSTATE.integrity, constraint: "candidates_immutable" },
      );
      await client.query("ROLLBACK TO SAVEPOINT before_update");
      await expectViolation(tx.delete(s.candidates).where(eq(s.candidates.id, c.id)), {
        code: SQLSTATE.integrity,
        constraint: "candidates_immutable",
      });
    }));
});

describe("releases: one active release per target (F15)", () => {
  it("rejects a second active release for the same target", () =>
    withRollback(async (tx) => {
      const ws = await f.workspace(tx);
      const first = await f.release(tx, ws.id);
      await expectViolation(f.release(tx, ws.id, { targetId: first.targetId }), {
        code: SQLSTATE.unique,
        constraint: "releases_one_active_per_target",
      });
    }));

  it("allows a new release once the previous one is terminal", () =>
    withRollback(async (tx) => {
      const ws = await f.workspace(tx);
      const first = await f.release(tx, ws.id);
      await tx
        .update(s.releases)
        .set({ state: "completed", terminalAt: new Date() })
        .where(eq(s.releases.id, first.id));
      const second = await f.release(tx, ws.id, { targetId: first.targetId });
      expect(second.state).toBe("awaiting_approval");
    }));

  it("rejects a terminal state without terminal_at, so the active-release index can't be bypassed", () =>
    withRollback(async (tx) => {
      const ws = await f.workspace(tx);
      await expectViolation(f.release(tx, ws.id, { state: "completed" }), {
        code: SQLSTATE.check,
        constraint: "releases_terminal_at_check",
      });
    }));

  it("rejects an unknown state", () =>
    withRollback(async (tx) => {
      const ws = await f.workspace(tx);
      const r = await f.release(tx, ws.id);
      await expectViolation(
        tx.execute(sql`UPDATE releases SET state = 'shipped' WHERE id = ${r.id}`),
        { code: SQLSTATE.check, constraint: "releases_state_check" },
      );
    }));
});

describe("rehearsals: ordered attempts, ephemeral project owned once", () => {
  it("rejects a duplicate attempt number for a release", () =>
    withRollback(async (tx) => {
      const ws = await f.workspace(tx);
      const first = await f.rehearsal(tx, ws.id);
      await expectViolation(f.rehearsal(tx, ws.id, { releaseId: first.releaseId }), {
        code: SQLSTATE.unique,
        constraint: "rehearsals_release_attempt_key",
      });
    }));

  it("rejects two rehearsals claiming the same Railway project, but allows many without one", () =>
    withRollback(async (tx) => {
      const ws = await f.workspace(tx);
      await f.rehearsal(tx, ws.id);
      await f.rehearsal(tx, ws.id); // both railway_project_id NULL: allowed
      await f.rehearsal(tx, ws.id, { railwayProjectId: "proj-eph-1" });
      await expectViolation(f.rehearsal(tx, ws.id, { railwayProjectId: "proj-eph-1" }), {
        code: SQLSTATE.unique,
        constraint: "rehearsals_railway_project_key",
      });
    }));
});

describe("check_runs: retries are explicit, not overwrites", () => {
  const run = (workspaceId: string, rehearsalId: string, attempt: number) => ({
    workspaceId,
    rehearsalId,
    checkId: "orders.create",
    checkVersion: "1",
    attempt,
  });

  it("rejects a duplicate (rehearsal, check, attempt) and allows the next attempt", () =>
    withRollback(async (tx) => {
      const ws = await f.workspace(tx);
      const rh = await f.rehearsal(tx, ws.id);
      await tx.insert(s.checkRuns).values(run(ws.id, rh.id, 1));
      await tx.insert(s.checkRuns).values(run(ws.id, rh.id, 2));
      await expectViolation(tx.insert(s.checkRuns).values(run(ws.id, rh.id, 1)), {
        code: SQLSTATE.unique,
        constraint: "check_runs_attempt_key",
      });
    }));

  it("rejects a result without finished_at", () =>
    withRollback(async (tx) => {
      const ws = await f.workspace(tx);
      const rh = await f.rehearsal(tx, ws.id);
      await expectViolation(
        tx.insert(s.checkRuns).values({ ...run(ws.id, rh.id, 1), result: "pass" }),
        { code: SQLSTATE.check, constraint: "check_runs_finished_check" },
      );
    }));
});

describe("evidence_bundles: sealed evidence is immutable", () => {
  it("rejects a second bundle for the same rehearsal", () =>
    withRollback(async (tx) => {
      const ws = await f.workspace(tx);
      const first = await f.evidence(tx, ws.id);
      await expectViolation(f.evidence(tx, ws.id, { rehearsalId: first.rehearsalId }), {
        code: SQLSTATE.unique,
        constraint: "evidence_bundles_rehearsal_key",
      });
    }));

  it("requires coverage gaps as an array, even when empty", () =>
    withRollback(async (tx) => {
      const ws = await f.workspace(tx);
      await expectViolation(f.evidence(tx, ws.id, { coverageGaps: {} }), {
        code: SQLSTATE.check,
        constraint: "evidence_bundles_coverage_gaps_check",
      });
    }));

  it("allows sealing an unsealed bundle, then rejects UPDATE and DELETE", () =>
    withRollback(async (tx, client) => {
      const ws = await f.workspace(tx);
      const bundle = await f.evidence(tx, ws.id);
      const byId = eq(s.evidenceBundles.id, bundle.id);
      await tx.update(s.evidenceBundles).set({ sealedAt: new Date() }).where(byId);
      await client.query("SAVEPOINT sealed");
      await expectViolation(
        tx
          .update(s.evidenceBundles)
          .set({ contentHash: sha("e") })
          .where(byId),
        { code: SQLSTATE.integrity, constraint: "evidence_bundles_sealed_immutable" },
      );
      await client.query("ROLLBACK TO SAVEPOINT sealed");
      await expectViolation(tx.delete(s.evidenceBundles).where(byId), {
        code: SQLSTATE.integrity,
        constraint: "evidence_bundles_sealed_immutable",
      });
    }));
});

describe("approvals: history preserved", () => {
  it("rejects DELETE", () =>
    withRollback(async (tx) => {
      const ws = await f.workspace(tx);
      const a = await f.approval(tx, ws.id);
      await expectViolation(tx.delete(s.approvals).where(eq(s.approvals.id, a.id)), {
        code: SQLSTATE.integrity,
        constraint: "approvals_history_preserved",
      });
    }));

  it("allows one revocation, then rejects a second", () =>
    withRollback(async (tx) => {
      const ws = await f.workspace(tx);
      const a = await f.approval(tx, ws.id);
      const byId = eq(s.approvals.id, a.id);
      await tx
        .update(s.approvals)
        .set({ revokedAt: new Date(), revokedReason: "evidence changed" })
        .where(byId);
      await expectViolation(
        tx.update(s.approvals).set({ revokedReason: "rewritten" }).where(byId),
        { code: SQLSTATE.integrity, constraint: "approvals_history_preserved" },
      );
    }));

  it("rejects changing what was approved", () =>
    withRollback(async (tx) => {
      const ws = await f.workspace(tx);
      const a = await f.approval(tx, ws.id);
      await expectViolation(
        tx
          .update(s.approvals)
          .set({ bindingHash: sha("f") })
          .where(eq(s.approvals.id, a.id)),
        { code: SQLSTATE.integrity, constraint: "approvals_history_preserved" },
      );
    }));
});

describe("operation_intents: idempotent intent creation", () => {
  it("rejects a duplicate logical key in a workspace, allows it in another", () =>
    withRollback(async (tx) => {
      const a = await f.workspace(tx);
      const b = await f.workspace(tx);
      await f.intent(tx, a.id, { logicalKey: "rh-1/project.create" });
      await f.intent(tx, b.id, { logicalKey: "rh-1/project.create" });
      await expectViolation(f.intent(tx, a.id, { logicalKey: "rh-1/project.create" }), {
        code: SQLSTATE.unique,
        constraint: "operation_intents_logical_key",
      });
    }));
});

describe("resources: no double-owned provider resource", () => {
  it("rejects a duplicate provider id, allows many unknown ones", () =>
    withRollback(async (tx) => {
      const ws = await f.workspace(tx);
      await f.resource(tx, ws.id);
      await f.resource(tx, ws.id); // provider_id NULL twice: allowed
      await f.resource(tx, ws.id, { providerId: "railway-proj-1" });
      await expectViolation(f.resource(tx, ws.id, { providerId: "railway-proj-1" }), {
        code: SQLSTATE.unique,
        constraint: "resources_provider_key",
      });
    }));

  it("rejects a duplicate ownership name", () =>
    withRollback(async (tx) => {
      const ws = await f.workspace(tx);
      const r = await f.resource(tx, ws.id);
      await expectViolation(f.resource(tx, ws.id, { ownershipName: r.ownershipName }), {
        code: SQLSTATE.unique,
        constraint: "resources_ownership_name_key",
      });
    }));
});

describe("cleanup_runs: one active cleanup per rehearsal", () => {
  it("rejects a second active run, including while needs_attention", () =>
    withRollback(async (tx) => {
      const ws = await f.workspace(tx);
      const rh = await f.rehearsal(tx, ws.id);
      await tx
        .insert(s.cleanupRuns)
        .values({ workspaceId: ws.id, rehearsalId: rh.id, state: "needs_attention" });
      await expectViolation(
        tx.insert(s.cleanupRuns).values({ workspaceId: ws.id, rehearsalId: rh.id }),
        {
          code: SQLSTATE.unique,
          constraint: "cleanup_runs_one_active_per_rehearsal",
        },
      );
    }));

  it("allows a new run once the previous one is verified_gone", () =>
    withRollback(async (tx) => {
      const ws = await f.workspace(tx);
      const rh = await f.rehearsal(tx, ws.id);
      await tx
        .insert(s.cleanupRuns)
        .values({ workspaceId: ws.id, rehearsalId: rh.id, state: "verified_gone" });
      await tx.insert(s.cleanupRuns).values({ workspaceId: ws.id, rehearsalId: rh.id });
    }));

  it("rejects the removed 'abandoned' state", () =>
    withRollback(async (tx) => {
      const ws = await f.workspace(tx);
      const rh = await f.rehearsal(tx, ws.id);
      await expectViolation(
        tx.execute(
          sql`INSERT INTO cleanup_runs (workspace_id, rehearsal_id, state) VALUES (${ws.id}, ${rh.id}, 'abandoned')`,
        ),
        { code: SQLSTATE.check, constraint: "cleanup_runs_state_check" },
      );
    }));
});

describe("audit_events: append-only", () => {
  it("rejects UPDATE, DELETE and TRUNCATE", () =>
    withRollback(async (tx, client) => {
      const ws = await f.workspace(tx);
      const ev = one(
        await tx
          .insert(s.auditEvents)
          .values({ workspaceId: ws.id, actor: "system", action: "rehearsal.started" })
          .returning(),
      );
      const byId = eq(s.auditEvents.id, ev.id);
      const append = { code: SQLSTATE.integrity, constraint: "audit_events_append_only" };
      await client.query("SAVEPOINT a");
      await expectViolation(tx.update(s.auditEvents).set({ action: "edited" }).where(byId), append);
      await client.query("ROLLBACK TO SAVEPOINT a");
      await expectViolation(tx.delete(s.auditEvents).where(byId), append);
      await client.query("ROLLBACK TO SAVEPOINT a");
      await expectViolation(tx.execute(sql`TRUNCATE audit_events`), append);
    }));
});
