import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
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
