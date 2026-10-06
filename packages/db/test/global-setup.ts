// Creates a throwaway database per test run, migrates it, and drops it afterwards.
// Requires DATABASE_URL pointing at a server where the user may CREATE DATABASE
// (docker compose locally, the postgres service in CI).
import pg from "pg";
import type { TestProject } from "vitest/node";
import { runMigrations } from "../src/migrate.js";

declare module "vitest" {
  export interface ProvidedContext {
    testDatabaseUrl: string;
  }
}

export default async function setup(project: TestProject) {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) {
    throw new Error("DATABASE_URL is not set. Start Postgres with `docker compose up -d --wait`.");
  }
  const name = `sy_test_${String(process.pid)}_${String(Date.now())}`;
  const admin = new pg.Client({ connectionString: baseUrl });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);

  const url = new URL(baseUrl);
  url.pathname = `/${name}`;
  await runMigrations(url.toString());
  project.provide("testDatabaseUrl", url.toString());

  return async () => {
    await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
    await admin.end();
  };
}
