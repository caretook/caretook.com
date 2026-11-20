// Playwright Test's config for the browser-check specs (`<check>.spec.mjs`).
// browser.sh (`pnpm prd browser`) runs one spec at a time with this config:
// one worker, no retries (browser.sh retries once on contention and logs
// FLAKY), and the checks' own reporter (reporter.mjs), which prints the PASS,
// FAIL and SKIP lines and the "N/M passed" tally browser.sh reads. Test
// artifacts (traces of failures) go to CARETOOK_PW_OUTPUT, the worktree's git
// dir, never the repo.
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.mjs",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  forbidOnly: true,
  // browser.sh's silence limit and cap end a stuck run; this ends a stuck test.
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [[join(import.meta.dirname, "reporter.mjs")]],
  outputDir: process.env.CARETOOK_PW_OUTPUT ?? join(tmpdir(), "caretook-browser-checks"),
  use: {
    baseURL: process.env.BASE ?? "http://localhost:5176",
    viewport: { width: 420, height: 900 },
    timezoneId: "America/Los_Angeles",
    locale: "en-US",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
