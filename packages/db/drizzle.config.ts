import { defineConfig } from "drizzle-kit";

// Used only by drizzle-kit to generate migrations from src/schema.ts. Generated SQL is
// reviewed and committed; custom migrations (triggers) are created with `generate --custom`.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations",
  strict: true,
  verbose: true,
});
