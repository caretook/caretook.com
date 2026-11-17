import { defineConfig } from "vitest/config";

// Vitest projects:
//   data:unit    pure functions, no database (packages/data *.test.ts)
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
