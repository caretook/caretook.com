import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import { deviceCommands } from "./apps/web/test/commands.ts";

// Vitest projects:
//   data:unit    pure functions, no database (packages/data *.test.ts)
//   web:unit     pure apps/web logic (apps/web/app *.test.ts)
//   notifications:unit  templates, links and the allowlist (packages/notifications *.test.ts)
//   scripts:unit repo tooling (scripts/**/*.test.mjs): the backlog and git
//                hooks, against throwaway git repos in the OS temp dir
//   integration  real Postgres, every package (*.int.test.ts): the test
//                database on port 5435. Start it with `pnpm datastore:up:test`;
//                each run clears and migrates it first. One project (not one
//                per package) because they share that database, and each
//                project's globalSetup would clear it under the other.
//   web:components  screens and components in real headless Chromium
//                (*.browser.test.tsx beside what they test, and apps/web/test/):
//                apps/web's Vite config (`~/`, Tailwind, daisyUI, the yjs and
//                React dedupes), and the test device (apps/web/test/device.tsx),
//                a local-only PowerSync database with fixtures. Chromium comes
//                from `pnpm test:components:install` (once per machine).
// The component tests' browser server port, one per checkout: Vitest's fixed
// default (23315) fails with "Port 23315 is already in use" when two worktrees
// run component tests at once (the browser lease allows four).
let hash = 7;
for (const c of process.cwd()) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
const browserPort = 23400 + (hash % 2000);

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
        // @caretook/notifications' pure parts: templates, links, allowlist.
        test: {
          name: "notifications:unit",
          root: "./packages/notifications",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.int.test.ts"],
        },
      },
      {
        test: {
          name: "scripts:unit",
          root: "./scripts",
          include: ["**/*.test.mjs"],
          exclude: ["browser-checks/**"],
          // Each test runs dozens of git commands (3–3.5 s alone), so the
          // 5 s default fails them whenever the rest of `pnpm check` runs beside them.
          testTimeout: 20_000,
        },
      },
      {
        extends: "./apps/web/vite.config.ts",
        test: {
          name: "web:components",
          root: "./apps/web",
          include: ["app/**/*.browser.test.tsx", "test/**/*.browser.test.tsx"],
          setupFiles: ["./test/setup.ts"],
          // Takes the machine-wide browser lease around Chromium (see the file).
          globalSetup: ["./test/browserLease.ts"],
          // The browser server's port, one per checkout (see `browserPort`).
          api: { port: browserPort, strictPort: false },
          browser: {
            enabled: true,
            headless: true,
            // The seeds' zone and an English locale, so times and dates read
            // the same on every machine.
            provider: playwright({ contextOptions: { timezoneId: "America/Los_Angeles", locale: "en-US" } }),
            instances: [{ browser: "chromium" }],
            viewport: { width: 420, height: 900 },
            screenshotFailures: false,
            // Page-level commands for tests (apps/web/test/commands.ts).
            commands: deviceCommands,
          },
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
