#!/usr/bin/env node
// pnpm build:budget: build the web target, then check its initial chunks
// against scripts/build/budget.json. `--no-build` checks the existing build;
// `--print-limits` prints today's sizes plus 10% (to set the ceilings).

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { checkBudget, formatTable, formatViolation, groupSize } from "./budget.mjs";
import { readListing } from "./manifest.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../..");
const args = process.argv.slice(2);

if (!args.includes("--no-build")) {
  const build = spawnSync("pnpm", ["--filter", "@caretook/web", "build"], { cwd: root, stdio: "inherit" });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const budget = JSON.parse(readFileSync(join(here, "budget.json"), "utf8"));
const listing = readListing(join(root, "apps/web/build/web/client"));

if (args.includes("--print-limits")) {
  for (const group of Object.keys(listing.groups)) {
    console.log(group, groupSize(listing, group), Math.ceil(groupSize(listing, group) * 1.1));
  }
  process.exit(0);
}

console.log(formatTable(listing, budget));
const violations = checkBudget(listing, budget);
for (const v of violations) console.error(`over budget: ${formatViolation(v)}`);
process.exit(violations.length ? 1 : 0);
