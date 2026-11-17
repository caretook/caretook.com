import { defineConfig } from "drizzle-kit";
import { loadEnv } from "./src/utils/loadEnv";

// .env.<NODE_ENV>, then .env (missing files are fine; CI sets env vars directly).
loadEnv();

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  // Always ask for confirmation and print every statement.
  strict: true,
  verbose: true,
});
