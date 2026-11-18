import { defineConfig } from "vitest/config";

// Vitest projects:
//   data:unit    pure functions, no database (packages/data *.test.ts)
//   web:unit     pure apps/web logic (apps/web/app *.test.ts)
//   scripts:unit repo tooling (scripts/**/*.test.mjs): the backlog and git
//                hooks, against throwaway git repos in the OS temp dir
//   integration  real Postgres, every package (*.int.test.ts): the test
//                database on port 5435. Start it with `pnpm datastore:up:test`;
//                each run clears and migrates it first. One project (not one
//                per package) because they share that database, and each
//                project's globalSetup would clear it under the other.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "data:unit",
          root: "./packages/data",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.int.test.ts"],
        },
      },
      {
        // Pure apps/web logic (app/**/*.test.ts): no PowerSync, no React Router
        // plugin (apps/web's vite.config.ts isn't loaded), so tests import
        // relatively, not through "~/".
        test: {
          name: "web:unit",
          root: "./apps/web",
          include: ["app/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "scripts:unit",
          root: "./scripts",
          include: ["**/*.test.mjs"],
          exclude: ["browser-checks/**"],
        },
      },
      {
        test: {
          name: "integration",
          include: ["packages/*/src/**/*.int.test.ts"],
          env: {
            NODE_ENV: "test",
            BETTER_AUTH_SECRET: "test-only-secret-never-used-outside-tests-0123456789",
            BETTER_AUTH_URL: "http://localhost:5173",
          },
          globalSetup: ["./packages/data/test/globalSetup.ts"],
          setupFiles: ["./packages/data/test/setup.ts"],
          // One shared database: run files one at a time.
          fileParallelism: false,
        },
      },
    ],
  },
});
