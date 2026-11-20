#!/usr/bin/env node
// pnpm deploy:smoke <staging|production>: the deploy's last step (hosting
// slice 5). Runs the smoke checks (smoke-checks.mjs) against the target's
// APP_URL (default: its canonical host) and POWERSYNC_URL, prints a table,
// and exits 1 on any failure, 2 on a bad target or a missing POWERSYNC_URL.
import { isDeployTarget, TARGET_HOSTS } from "../../apps/web/app/.server/deployEnv.ts";
import { formatSmokeTable, smoke } from "./smoke-checks.mjs";

const target = process.argv[2];
if (!isDeployTarget(target)) {
  console.error("usage: pnpm deploy:smoke <staging|production>");
  process.exit(2);
}
const appUrl = process.env.APP_URL?.trim() || `https://${TARGET_HOSTS[target]}`;
const powersyncUrl = process.env.POWERSYNC_URL?.trim();
if (!powersyncUrl) {
  console.error("POWERSYNC_URL is not set");
  process.exit(2);
}

const results = await smoke({ appUrl, powersyncUrl, fetch, staging: target === "staging" });
for (const line of formatSmokeTable(results)) console.log(line);
const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`✗ The ${target} smoke check failed: ${failed.map((r) => r.name).join(", ")}`);
  process.exit(1);
}
console.log(`✓ The ${target} deploy is serving.`);
