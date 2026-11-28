// Caretook's check-plan rules (check-plan-rules.json) through the core's engine
// (risa's loops/check-plan.mjs): the tier a landing waits for, by path. The
// package exports neither module, so they're reached by file URL.
import { realpathSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "./risa.mjs";

const core = realpathSync(join(REPO_ROOT, "node_modules/risa"));
const load = (/** @type {string} */ file) => import(pathToFileURL(join(core, file)).href);
const { checkPlanFor } = await load("loops/check-plan.mjs");
const { loadConfig } = await load("loops/config.mjs");
const plan = checkPlanFor(loadConfig({ path: join(REPO_ROOT, "risa.json") }));
const tier = (/** @type {string} */ file) => plan.proposeTier([file]).tier;

describe("scripts/build/ (B-851)", () => {
  it("asks for the unit tier, which runs its unit tests, for a hand-run script or a new file", () => {
    expect(tier("scripts/build/share-image.mjs")).toBe("unit");
    expect(tier("scripts/build/pins.mjs")).toBe("unit");
    expect(tier("scripts/build/pins.test.mjs")).toBe("unit");
    const fresh = tier("scripts/build/a-new-script.mjs");
    expect(plan.tierRank(fresh)).toBeLessThanOrEqual(plan.tierRank("unit"));
    expect(fresh).not.toBe("none");
  });

  it("keeps the full tier for what the web build runs and the budget it checks", () => {
    for (const file of [
      "scripts/build/service-worker.mjs",
      "scripts/build/manifest.mjs",
      "scripts/build/chunks.mjs",
      "scripts/build/chunks.d.mts",
      "scripts/build/budget.mjs",
      "scripts/build/budget.json",
      "scripts/build/check.mjs",
    ])
      expect(tier(file), file).toBe("full");
    // Their unit tests need only the unit tier.
    expect(tier("scripts/build/chunks.test.mjs")).toBe("unit");
    expect(tier("scripts/build/service-worker.test.mjs")).toBe("unit");
  });
});
