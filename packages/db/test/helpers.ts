import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import { afterAll, expect, inject } from "vitest";
import * as schema from "../src/schema.js";

const pool = new pg.Pool({ connectionString: inject("testDatabaseUrl") });
afterAll(() => pool.end());

export type Tx = NodePgDatabase<typeof schema>;

/** Runs `fn` inside a transaction that is always rolled back, so tests never see each other. */
export async function withRollback(fn: (tx: Tx, client: pg.PoolClient) => Promise<void>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await fn(drizzle(client, { schema }), client);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
}

/** The underlying Postgres error, unwrapped from Drizzle's query error. */
function pgError(error: unknown): pg.DatabaseError | undefined {
  let current: unknown = error;
  while (current instanceof Error) {
    if (current instanceof pg.DatabaseError) return current;
    current = current.cause;
  }
  return undefined;
}

/** Asserts the database rejected the statement with this SQLSTATE and constraint name. */
export async function expectViolation(
  statement: Promise<unknown>,
  expected: { code: string; constraint: string },
) {
  const error = await statement.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error, "expected the database to reject the statement").toBeDefined();
  const db = pgError(error);
  expect({ code: db?.code, constraint: db?.constraint }).toEqual(expected);
}

export const SQLSTATE = {
  integrity: "23000",
  foreignKey: "23503",
  unique: "23505",
  check: "23514",
} as const;

/** The single row an INSERT ... RETURNING produced. */
export function one<T>(rows: T[]): T {
  const [row] = rows;
  if (row === undefined) throw new Error("expected exactly one row");
  return row;
}

export const digest = (c: string) => `sha256:${c.repeat(64)}`;
export const sha = (c: string) => c.repeat(64);
