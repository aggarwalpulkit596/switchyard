// Applies committed migrations in order. Run with `pnpm db:migrate`; reads DATABASE_URL.
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "node:url";
import { createDatabase } from "./client.js";

export const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));

export async function runMigrations(connectionString: string): Promise<void> {
  const { db, pool } = createDatabase(connectionString);
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await pool.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("db:migrate: DATABASE_URL is not set");
    process.exit(1);
  }
  await runMigrations(url);
  console.log("db:migrate: migrations applied");
}
