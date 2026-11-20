#!/usr/bin/env node
// pnpm deploy:env <staging|production>: the deploy's first step (hosting
// slice 1). Checks this process's environment with checkDeployEnv
// (apps/web/app/.server/deployEnv.ts, run directly through Node's type
// stripping) and prints each problem by variable name, never a value.
// Exits 1 on any problem, 2 on a bad target.
import {
  checkDeployEnv,
  formatDeployEnvProblems,
  isDeployTarget,
} from "../../apps/web/app/.server/deployEnv.ts";

const target = process.argv[2];
if (!isDeployTarget(target)) {
  console.error("usage: pnpm deploy:env <staging|production>");
  process.exit(2);
}

const problems = checkDeployEnv(target, process.env);
if (problems.length) {
  console.error(`✗ The ${target} environment has ${problems.length} problem(s):`);
  for (const line of formatDeployEnvProblems(problems)) console.error(`  ${line}`);
  process.exit(1);
}
console.log(`✓ The ${target} environment is complete.`);
