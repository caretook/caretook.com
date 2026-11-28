import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import { deviceCommands } from "./apps/web/test/commands.ts";
import { intWorkers } from "./packages/data/src/db/testDatabase.ts";
import { parseQuarantine, quarantineMode } from "./scripts/ci/lists.mjs";
import { DurationSequencer } from "./scripts/ci/shard-sequencer.mjs";
import { PRIMARY_ZONE, SECOND_ZONE, testZone } from "./scripts/ci/zones.mjs";

// Vitest projects:
//   data:unit    pure functions, no database (packages/data *.test.ts)
//   web:unit     pure apps/web logic (apps/web/app *.test.ts)
//   notifications:unit  templates, links and the allowlist (packages/notifications *.test.ts)
//   server:unit  packages/auth and packages/api's pure parts (*.test.ts): origins,
//                the client IP, /rpc's CORS answer; no database
//   Caretook's tooling tests (the tool's own, Risa's, run in its repo;
//   scripts/project/test-projects.test.mjs keeps every one in exactly one
//   project). `pnpm test:project`:
//   project:unit    the ones `pnpm test` keeps: the check manifest's and areas'
//                   guards, the sync matrix (quick-guards keeps it and rolesSql
//                   in projects every quick check runs), Caretook's CI jobs, the
//                   deploy, the build and the local lint rules
//   project:tooling the rest (the hooks, the check's body, the doc budget, …),
//                   run by `pnpm test:tooling`, not `pnpm test`
//   tooling:browser  project/browser-run.test.mjs (Caretook's browser check runner)
//                alone: it launches Playwright and waits on checks that hang on
//                purpose. `pnpm test:browser-harness`; `pnpm test:tooling` adds it
//                when the change touches what it tests; CI runs it in the integration job
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
// Caretook's tooling tests outside scripts/project/, by name. PROJECT_UNIT: the
// ones `pnpm test` runs, matched in scripts/loops, scripts/ci or scripts/project, so
// moving one into scripts/project/ changes nothing here. PROJECT_TOOLING: the ones
// it doesn't, still in scripts/loops (the rest of scripts/project/ joins project:tooling
// by its folder).
const PROJECT_UNIT = [
  "sync-matrix",
  "check-areas",
  "check-plan-rules",
  "checks",
  "browser-job",
  "env",
  "lists",
  "release-jobs",
  "shards",
  "test-job",
  "tiers",
  "verdict",
  "zones",
  "quick-guards",
  "unit-workers",
].map((name) => `{loops,ci,project}/${name}.test.mjs`);
const PROJECT_TOOLING = ["fixes-plans", "lint-heap", "workspace-config"].map(
  (name) => `loops/${name}.test.mjs`,
);

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

// Integration workers, each on its own database (packages/data/test/globalSetup.ts).
const integrationWorkers = intWorkers(process.env.CARETOOK_INT_WORKERS);
if (integrationWorkers === undefined) throw new Error("CARETOOK_INT_WORKERS must be a number from 1 to 16");

// The unit projects' workers (CARETOOK_UNIT_WORKERS): Vitest's default is cores − 1,
// so two overlapping checks ran ~18 test processes on 10 cores (B-542). Half the
// cores, at most 4, unless set (1 to 64). The tooling projects keep the default.
const MAX_UNIT_WORKERS = 64;
export const unitWorkers = (
  value: string | undefined,
  cores = availableParallelism(),
): number | undefined => {
  if (value === undefined || value.trim() === "") return Math.max(1, Math.min(4, Math.floor(cores / 2)));
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= MAX_UNIT_WORKERS ? n : undefined;
};
const unitWorkerCount = unitWorkers(process.env.CARETOOK_UNIT_WORKERS);
if (unitWorkerCount === undefined) throw new Error("CARETOOK_UNIT_WORKERS must be a number from 1 to 64");
// The unit projects: one group (Vitest runs the projects that share a
// sequence.groupOrder on one pool, so they must share maxWorkers too).
const unit = { maxWorkers: unitWorkerCount };
// The tooling projects: Vitest's default workers, in a group of their own (3, after
// integration) so a run with every project doesn't put two caps in one group.
// `pnpm test:tooling` and the check's tooling step run them alone.
const tooling = { sequence: { groupOrder: 3 } };

// Quarantined tests are skipped in every project (scripts/ci/quarantine.txt), or
// alone are run under CARETOOK_QUARANTINE=run. Handed over by `provide` so the
// setup also works in the browser project, which can't read the disk.
const quarantineSetup = fileURLToPath(new URL("./scripts/ci/quarantine-setup.mjs", import.meta.url));
const caretookQuarantine = {
  entries: parseQuarantine(readFileSync(new URL("./scripts/ci/quarantine.txt", import.meta.url), "utf8")),
  mode: quarantineMode(),
};
const withQuarantine = <P extends { test: { setupFiles?: string[] } }>(project: P) => ({
  ...project,
  test: {
    ...project.test,
    setupFiles: [quarantineSetup, ...(project.test.setupFiles ?? [])],
    provide: { caretookQuarantine },
  },
});

// Node's projects run in one zone, the seeds' (TZ, which Node reads for Date and
// Intl), so a result can't differ between the Mac and CI's UTC runners. Not the
// browser projects: their zone is the browser context's. zones.test.mjs checks it.
const inNodeZone = <P extends { test: { env?: Record<string, string>; browser?: unknown } }>(project: P) =>
  project.test.browser
    ? project
    : { ...project, test: { ...project.test, env: { ...project.test.env, TZ: PRIMARY_ZONE } } };

// The component tests' projects: `web:components` (every file, in the test zone)
// and `web:components:ny` (NY_INCLUDE, in the second zone). The device's zone is
// the browser context's; the recipient's is the fixtures' (TEST_TIME_ZONE).
const COMPONENT_FILES = ["app/**/*.browser.test.tsx", "test/**/*.browser.test.tsx"];
// The second zone's every-run files: the ones written to test the zones apart, which
// build their moments with apps/web/test/zone.ts (zones.test.mjs keeps this list and
// those imports the same). The release tier's zone-components jobs run every
// component file in the second zone (B-772).
const NY_INCLUDE = [
  "app/routes/app/groups/medications/today.browser.test.tsx",
  "app/routes/app/groups/planner/plannerEvents.browser.test.tsx",
  "app/routes/app/groups/planner/plannerSeries.browser.test.tsx",
  "app/routes/app/groups/timeline/timelineHeader.browser.test.tsx",
  "app/routes/app/groups/timeline/timelineZones.browser.test.tsx",
  "app/routes/app/groups/timeline/todayCard.browser.test.tsx",
];
const componentsProject = (name: string, zone: string, port: number, include = COMPONENT_FILES) => ({
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
    name,
    // The browser server listens on this port (Vitest 5 reads `test.api`).
    api: { port },
    root: "./apps/web",
    include,
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
      // The device's zone (the seeds' by default) and an English locale, so
      // times and dates read the same on every machine.
      provider: playwright({ contextOptions: { timezoneId: zone, locale: "en-US" } }),
      instances: [{ browser: "chromium" }],
      viewport: { width: 420, height: 900 },
      screenshotFailures: false,
      // Page-level commands for tests (apps/web/test/commands.ts).
      commands: deviceCommands,
    },
  },
});

export default defineConfig({
  test: {
    // `--shard` balances files by their past seconds (scripts/ci/shards.mjs), not by count.
    sequence: { sequencer: DurationSequencer },
    projects: [
      {
        test: {
          name: "data:unit",
          ...unit,
          root: "./packages/data",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.int.test.ts"],
        },
      },
      {
        // Pure apps/web logic (app/**/*.test.ts): no PowerSync, no React Router
        // plugin (apps/web's vite.config.ts isn't loaded). "~/" resolves as in
        // web:components, through apps/web's tsconfig paths (B-375). Plus the
        // test harness's own Node parts (test/*.test.ts: the browser lease helper).
        resolve: { tsconfigPaths: true },
        test: {
          name: "web:unit",
          ...unit,
          root: "./apps/web",
          include: ["app/**/*.test.ts", "test/**/*.test.ts"],
        },
      },
      {
        // @caretook/notifications' pure parts: templates, links, allowlist.
        test: {
          name: "notifications:unit",
          ...unit,
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
          ...unit,
          include: ["packages/auth/src/**/*.test.ts", "packages/api/src/**/*.test.ts"],
          exclude: ["**/*.int.test.ts"],
        },
      },
      {
        // Caretook's tooling tests the default run keeps.
        test: {
          name: "project:unit",
          ...unit,
          root: "./scripts",
          include: [...PROJECT_UNIT, "deploy/**/*.test.mjs", "build/**/*.test.mjs", "eslint/**/*.test.mjs"],
          testTimeout: 20_000,
        },
      },
      {
        // Caretook's other tooling tests: `pnpm test` leaves them out. Many run
        // git commands, so the 5 s default fails them beside the rest of `pnpm
        // check`; the load gate is off for every script they spawn.
        test: {
          name: "project:tooling",
          ...tooling,
          root: "./scripts",
          include: [...PROJECT_TOOLING, "project/**/*.test.mjs", "hooks.test.mjs"],
          // The runner's test is the browser harness's (tooling:browser).
          exclude: [...PROJECT_UNIT, "project/browser-run.test.mjs"],
          testTimeout: 20_000,
          env: { RISA_LOAD_GATE: "off" },
        },
      },
      {
        test: {
          name: "tooling:browser",
          ...tooling,
          root: "./scripts",
          include: ["project/browser-run.test.mjs"],
          testTimeout: 20_000,
          env: { RISA_LOAD_GATE: "off" },
        },
      },
      componentsProject("web:components", testZone(), await freePort()),
      // The second zone, every run: the tests that set the zones apart (the timeline,
      // doses, events), with the device in New York and the
      // recipient's fixtures still in Los Angeles (B-372). Its own project, since
      // one project's browser instances can't have different provider settings;
      // its own port, since the two run at once. A New York-only skip names its
      // item (`inSecondZone`, apps/web/test/zone.ts); never the shared quarantine.
      componentsProject("web:components:ny", SECOND_ZONE, await freePort(), NY_INCLUDE),
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
          // Points each worker at its own database, `caretook_tw_<stem>_<hash>_w<n>` (named in scripts/project/test-db.sh).
          setupFiles: ["./packages/data/test/setup.ts"],
          // Files in parallel, one per worker database. Its own maxWorkers needs
          // a group of its own: after web:components (1), before the tooling (3), so
          // the databases' load doesn't overlap Chromium's.
          maxWorkers: integrationWorkers,
          sequence: { groupOrder: 2 },
        },
      },
    ]
      .map(inNodeZone)
      .map(withQuarantine),
  },
});
