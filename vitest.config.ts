import { defineConfig } from "vitest/config";

// One entry per workspace project. packages/data has two:
//   unit         pure functions, no database (*.test.ts)
//   integration  real Postgres: the test database on port 5435 (*.int.test.ts).
//                Start it with `pnpm datastore:up:test`; each run clears and
//                migrates it first.
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
          name: "data:integration",
          root: "./packages/data",
          include: ["src/**/*.int.test.ts"],
          env: { NODE_ENV: "test" },
          globalSetup: ["./test/globalSetup.ts"],
          setupFiles: ["./test/setup.ts"],
          // One shared database: run files one at a time.
          fileParallelism: false,
        },
      },
    ],
  },
});
