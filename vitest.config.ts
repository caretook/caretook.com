import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import { deviceCommands } from "./apps/web/test/commands.ts";
import { intWorkers } from "./packages/data/src/db/testDatabase.ts";

// Vitest projects:
//   data:unit    pure functions, no database (packages/data *.test.ts)
//   web:unit     pure apps/web logic (apps/web/app *.test.ts)
//   notifications:unit  templates, links and the allowlist (packages/notifications *.test.ts)
//   server:unit  packages/auth and packages/api's pure parts (*.test.ts): origins,
//                the client IP, /rpc's CORS answer; no database
//   scripts:unit the tooling tests `pnpm test` keeps (sync-matrix, check-areas,
//                checks, check-times, check-plan, deploy, build, the lint rules)
//   tooling:unit the other tooling tests (scripts/loops, backlog, hooks), against
//                throwaway git repos in the OS temp dir; `pnpm test:tooling`
//   integration  real Postgres, every package (*.int.test.ts): the test
//                database on port 5435. Start it with `pnpm datastore:up:test`;
//                each run clears and migrates it first, then copies it for
//                each worker (CARETOOK_INT_WORKERS, default 3; 1 runs files
//                one at a time on the database itself). One project (not one
//                per package) because they share that database, and each
//                project's globalSetup would clear it under the other.
//   web:components  screens and components in real headless Chromium
//                (*.browser.test.tsx beside what they test, and apps/web/test/):
//                apps/web's Vite config (`~/`, Tailwind, daisyUI, the yjs and
//                React dedupes), and the test device (apps/web/test/device.tsx),
//                a local-only PowerSync database with fixtures. Chromium comes
//                from `pnpm test:components:install` (once per machine).
// A free port for the component tests' browser server: Vitest's default
// (23315) is fixed, so two worktrees running component tests at once clash.
const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
const browserPort = await freePort();

// Integration workers, each on its own database (packages/data/test/globalSetup.ts).
const integrationWorkers = intWorkers(process.env.CARETOOK_INT_WORKERS);
if (integrationWorkers === undefined) throw new Error("CARETOOK_INT_WORKERS must be a number from 1 to 16");

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
        // @caretook/auth and @caretook/api without a database: what imports
        // no db call (host.ts, the /rpc handler's CORS answer).
        test: {
          name: "server:unit",
          include: ["packages/auth/src/**/*.test.ts", "packages/api/src/**/*.test.ts"],
          exclude: ["**/*.int.test.ts"],
        },
      },
      {
        // The tooling tests the default run keeps: the ones that guard the
        // check manifest and areas, the deploy, the build and the local lint rules.
        test: {
          name: "scripts:unit",
          root: "./scripts",
          include: [
            "loops/sync-matrix.test.mjs",
            "loops/check-areas.test.mjs",
            "loops/checks.test.mjs",
            "loops/check-times.test.mjs",
            "loops/check-plan.test.mjs",
            "deploy/**/*.test.mjs",
            "build/**/*.test.mjs",
            "eslint/**/*.test.mjs",
          ],
          testTimeout: 20_000,
        },
      },
      {
        // The rest of the tooling tests (loops, backlog, hooks). Each runs dozens
        // of git commands (3–3.5 s alone), so the 5 s default fails them whenever
        // the rest of `pnpm check` runs beside them. `pnpm test` leaves this
        // project out; `pnpm test:tooling` runs it.
        test: {
          name: "tooling:unit",
          root: "./scripts",
          include: ["loops/**/*.test.mjs", "backlog/**/*.test.mjs", "hooks.test.mjs"],
          exclude: [
            "browser-checks/**",
            "loops/sync-matrix.test.mjs",
            "loops/check-areas.test.mjs",
            "loops/checks.test.mjs",
            "loops/check-times.test.mjs",
            "loops/check-plan.test.mjs",
          ],
          testTimeout: 20_000,
        },
      },
      {
        extends: "./apps/web/vite.config.ts",
        // Server-only modules (`~/.server/*`, which web-only routes import for
        // their loaders) resolve to stubs that throw if called: the test
        // device gives those routes `loaderData` instead (apps/web/test/server/).
        resolve: {
          alias: [
            {
              find: /^~\/\.server\/(.*)$/,
              replacement: fileURLToPath(new URL("./apps/web/test/server/$1", import.meta.url)),
            },
          ],
        },
        // The account and group pages import ORPCError for their loaders: pre-bundled
        // up front, so the first run doesn't re-optimize and reload mid-test. The
        // access code print test makes its QR code with `qrcode`, as the server does.
        optimizeDeps: { include: ["@orpc/server", "qrcode"] },
        test: {
          name: "web:components",
          // The browser server listens on this port (Vitest 5 reads `test.api`).
          api: { port: browserPort },
          root: "./apps/web",
          include: ["app/**/*.browser.test.tsx", "test/**/*.browser.test.tsx"],
          setupFiles: ["./test/setup.ts"],
          // Takes the machine-wide browser lease around Chromium (see the file).
          globalSetup: ["./test/browserLease.ts"],
          // Two test files at once (Vitest's default is cores − 1). Each file
          // is its own tab with its own PowerSync database, and the lease lets
          // four worktrees run at once: at 9 the tabs pinned every core and the
          // slowest tests passed 15 s and timed out (B-131 measured 4 as no
          // slower than 9 under load; 2 leaves room for the other loops).
          maxWorkers: 2,
          // Vitest runs projects with their own maxWorkers as a group of their
          // own: this one after the rest, so `pnpm check`'s unit and
          // integration tests aren't competing with Chromium either.
          sequence: { groupOrder: 1 },
          // expect.poll and expect.element give up after 1 s by default, which a
          // loaded machine passes before a route's clientLoader or first query
          // has answered (B-131): 5 s, `WAIT_TIMEOUT` in apps/web/test/found.ts
          // (the harness's one timeout; keep the two the same).
          expect: { poll: { timeout: 5000 } },
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
            CARETOOK_INT_WORKERS: String(integrationWorkers),
          },
          globalSetup: ["./packages/data/test/globalSetup.ts"],
          // Points each worker at its own database, `<name>_w<VITEST_POOL_ID>`.
          setupFiles: ["./packages/data/test/setup.ts"],
          // Files in parallel, one per worker database. Its own maxWorkers needs
          // a group of its own: after web:components (1), last as before, so
          // the databases' load doesn't overlap Chromium's.
          maxWorkers: integrationWorkers,
          sequence: { groupOrder: 2 },
        },
      },
    ],
  },
});
