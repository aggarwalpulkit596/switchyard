// Builds a minimal valid row graph. Each builder takes overrides so a test changes only
// the column it is about.
import * as s from "../src/schema.js";
import { digest, one, sha, type Tx } from "./helpers.js";

let counter = 0;
const unique = (prefix: string) => `${prefix}-${String(++counter)}`;
const hourFromNow = () => new Date(Date.now() + 3_600_000);

export async function workspace(tx: Tx) {
  return one(
    await tx
      .insert(s.workspaces)
      .values({ name: unique("ws") })
      .returning(),
  );
}

export async function target(
  tx: Tx,
  workspaceId: string,
  o: Partial<typeof s.targets.$inferInsert> = {},
) {
  return one(
    await tx
      .insert(s.targets)
      .values({
        workspaceId,
        railwayProjectId: unique("proj"),
        railwayEnvironmentId: "env-production",
        railwayServiceId: "svc-orders",
        ...o,
      })
      .returning(),
  );
}

export async function candidate(
  tx: Tx,
  workspaceId: string,
  o: Partial<typeof s.candidates.$inferInsert> = {},
) {
  return one(
    await tx
      .insert(s.candidates)
      .values({
        workspaceId,
        registryRepository: unique("ghcr.io/sy/demo-orders"),
        imageDigest: digest("a"),
        platform: "linux/amd64",
        ...o,
      })
      .returning(),
  );
}

export async function release(
  tx: Tx,
  workspaceId: string,
  o: Partial<typeof s.releases.$inferInsert> = {},
) {
  const targetId = o.targetId ?? (await target(tx, workspaceId)).id;
  const candidateId = o.candidateId ?? (await candidate(tx, workspaceId)).id;
  return one(
    await tx
      .insert(s.releases)
      .values({ workspaceId, targetId, candidateId, policyVersion: "v1", ...o })
      .returning(),
  );
}

export async function rehearsal(
  tx: Tx,
  workspaceId: string,
  o: Partial<typeof s.rehearsals.$inferInsert> = {},
) {
  const releaseId = o.releaseId ?? (await release(tx, workspaceId)).id;
  return one(
    await tx
      .insert(s.rehearsals)
      .values({
        workspaceId,
        releaseId,
        attempt: 1,
        fixtureVersion: "fx-1",
        ttlExpiresAt: hourFromNow(),
        ...o,
      })
      .returning(),
  );
}

export async function evidence(
  tx: Tx,
  workspaceId: string,
  o: Partial<typeof s.evidenceBundles.$inferInsert> = {},
) {
  const rehearsalId = o.rehearsalId ?? (await rehearsal(tx, workspaceId)).id;
  return one(
    await tx
      .insert(s.evidenceBundles)
      .values({
        workspaceId,
        rehearsalId,
        manifest: {},
        contentHash: sha("c"),
        coverageGaps: [],
        ...o,
      })
      .returning(),
  );
}

export async function approval(
  tx: Tx,
  workspaceId: string,
  o: Partial<typeof s.approvals.$inferInsert> = {},
) {
  const rh = await rehearsal(tx, workspaceId);
  const bundle = await evidence(tx, workspaceId, { rehearsalId: rh.id });
  return one(
    await tx
      .insert(s.approvals)
      .values({
        workspaceId,
        releaseId: rh.releaseId,
        evidenceBundleId: bundle.id,
        planManifest: {},
        bindingHash: sha("d"),
        actor: "user:pulkit",
        expiresAt: hourFromNow(),
        ...o,
      })
      .returning(),
  );
}

export async function intent(
  tx: Tx,
  workspaceId: string,
  o: Partial<typeof s.operationIntents.$inferInsert> = {},
) {
  return one(
    await tx
      .insert(s.operationIntents)
      .values({
        workspaceId,
        logicalKey: unique("create-project"),
        operation: "project.create",
        expectedState: {},
        desiredState: {},
        ...o,
      })
      .returning(),
  );
}

export async function resource(
  tx: Tx,
  workspaceId: string,
  o: Partial<typeof s.resources.$inferInsert> = {},
) {
  const intentId = o.intentId ?? (await intent(tx, workspaceId)).id;
  const rehearsalId = o.rehearsalId ?? (await rehearsal(tx, workspaceId)).id;
  return one(
    await tx
      .insert(s.resources)
      .values({
        workspaceId,
        intentId,
        rehearsalId,
        kind: "project",
        ownershipName: unique("sy-reh"),
        ...o,
      })
      .returning(),
  );
}
