// Caretook's check plan rules (check-plan-rules.json, named by risa.json's
// paths.checkPlanRules) through the core's engine: the mode, tier and reason each
// rule gives, as before the rules were data. Until the move; the removal commit
// drops this test with the engine.
import { describe, expect, it } from "vitest";
import { checkPlan } from "../loops/check-plan.mjs";
import { toolingProjects } from "../loops/tooling-tests.mjs";

const plan = checkPlan();

describe("the tier by rule", () => {
  it.each([
    ["docs/a.md", "none", "docs and tooling only"],
    ["packages/data/src/seed-notes.md", "none", "docs and tooling only"],
    ["scripts/loops/prd.sh", "none", "docs and tooling only"],
    ["scripts/backlog/b.mjs", "none", "docs and tooling only"],
    [".githooks/commit-msg", "none", "docs and tooling only"],
    ["scripts/hooks.test.mjs", "none", "docs and tooling only"],
    ["risa.json", "none", "docs and tooling only"],
    ["scripts/project/a.mjs", "none", "docs and tooling only"],
    ["scripts/project/check-plan-rules.json", "none", "docs and tooling only"],
    ["packages/data/src/db/migrations/0042_x.sql", "full", "a migration"],
    ["packages/data/scripts/seed.ts", "full", "seeds"],
    ["packages/data/src/Seeds/people.ts", "full", "seeds"],
    ["powersync/sync-config.yaml", "full", "the sync config"],
    ["pnpm-lock.yaml", "full", "the lockfile"],
    ["package.json", "full", "a package.json"],
    ["apps/web/package.json", "full", "a package.json"],
    ["vitest.config.ts", "full", "the Vitest config"],
    [".github/workflows/ci.yml", "full", "the CI workflow"],
    [".github/actions/setup/action.yml", "full", "the CI workflow"],
    ["scripts/ci/ci.mjs", "full", "scripts/ci"],
    ["apps/web/app/a.tsx", "components", "app code"],
    ["packages/api/src/a.ts", "integration", "server code"],
    ["scripts/loops/browser.sh", "integration", "the browser harness"],
    ["scripts/loops/browser.test.mjs", "integration", "the browser harness"],
    ["scripts/loops/lib.sh", "integration", "the browser harness"],
    ["scripts/loops/lease.sh", "integration", "the browser harness"],
    ["scripts/project/serve.sh", "integration", "the browser harness"],
    ["scripts/project/browser-run.sh", "integration", "the browser harness"],
    ["scripts/project/browser-run.test.mjs", "integration", "the browser harness"],
    ["scripts/loops/checks", "integration", "the browser harness"],
    ["scripts/loops/check-areas.d/timeline", "integration", "the browser harness"],
    ["scripts/project/check-areas.mjs", "integration", "the browser harness"],
    ["scripts/browser-checks/a.spec.mjs", "integration", "the browser harness"],
    ["eslint.config.js", "full", "a file no rule covers"],
    ["scripts/deploy/x.mjs", "full", "a file no rule covers"],
  ])("%s: %s, %s", (file, tier, why) => {
    const { tier: got, reason } = plan.proposeTier([file]);
    expect(got).toBe(tier);
    expect(reason).toBe(tier === "none" ? why : `${why} (${file})`);
  });

  it("takes a diff's highest", () => {
    expect(plan.proposeTier(["packages/api/src/a.ts", "apps/web/app/a.tsx"]).tier).toBe("components");
    expect(plan.proposeTier(["apps/web/app/a.tsx", "pnpm-lock.yaml"]).tier).toBe("full");
    expect(plan.proposeTier(["scripts/loops/lib.sh", "docs/a.md"]).tier).toBe("integration");
  });
});

describe("the check's mode and tests", () => {
  it.each([
    "packages/data/src/db/migrations/0042_x.sql",
    "powersync/sync-config.yaml",
    "pnpm-lock.yaml",
    "vitest.config.ts",
  ])("a quick check on %s stays quick", (file) => {
    expect(plan.planCheck(["apps/web/app/a.ts", file], "quick").mode).toBe("quick");
    expect(plan.planCheck(["apps/web/app/a.ts", file], "slice").mode).toBe("slice");
  });

  it("names the diff's own integration and component tests", () => {
    const own = plan.planCheck(
      [
        "packages/api/src/syncTodos.int.test.ts",
        "apps/web/app/routes/a.browser.test.tsx",
        "apps/web/app/routes/a.tsx",
        "apps/web/app/lib/a.test.ts",
        "scripts/browser-checks/a.spec.mjs",
      ],
      "slice",
    ).ownTests;
    expect(own).toEqual(["packages/api/src/syncTodos.int.test.ts", "apps/web/app/routes/a.browser.test.tsx"]);
  });

  it.each([
    "scripts/loops/prd.sh",
    "scripts/backlog/b.mjs",
    ".githooks/commit-msg",
    "scripts/hooks.test.mjs",
    "risa.json",
    "scripts/project/a.mjs",
  ])("joins the tooling tests for %s", (file) => expect(plan.planCheck([file], "quick").tooling).toBe(true));

  it("leaves the tooling tests out of an app diff", () => {
    expect(plan.planCheck(["apps/web/app/a.ts", "scripts/deploy/x.mjs"], "quick").tooling).toBe(false);
  });

  it("lints and formats only the changed tooling files", () => {
    expect(
      plan.planToolingLint([
        "scripts/loops/prd.sh",
        "scripts/hooks.test.mjs",
        "scripts/project/a.mjs",
        "scripts/project/a.md",
        "apps/web/app/a.ts",
      ]),
    ).toEqual({
      eslint: ["scripts/hooks.test.mjs", "scripts/project/a.mjs"],
      prettier: ["scripts/loops/prd.sh", "scripts/hooks.test.mjs", "scripts/project/a.mjs"],
    });
  });
});

describe("verdicts and dev syncs", () => {
  it.each([
    [["docs/a.md"], true],
    [["scripts/loops/prd.sh", "plans/a.md"], true],
    [["scripts/ci/quarantine.txt", "scripts/ci/brake-list.txt"], true],
    [["scripts/loops/browser.sh"], false],
    [["scripts/ci/ci.mjs"], false],
    [["apps/web/app/a.tsx"], false],
  ])("keepsVerdict %j: %s", (files, kept) => {
    expect(plan.keepsVerdict(files)).toBe(kept);
  });

  it.each([
    [["docs/a.md", "scripts/backlog/backlog.mjs"], [], "none"],
    // fixes-bug 82a3cf1b: dev brought lib.sh, and the carry broke on it
    [["scripts/loops/lib.sh", "scripts/loops/land.sh", "plans/backlog.md"], ["apps/web/a.tsx"], "none"],
    [["scripts/loops/lib.sh"], ["scripts/loops/lib.sh"], "integration"],
    [["scripts/ci/quarantine.txt"], [], "none"],
    [["packages/data/src/a.ts", "docs/a.md"], [], "integration"],
    [["apps/web/a.tsx"], [], "components"],
    [["pnpm-lock.yaml"], [], "full"],
  ])("syncTier: brought %j, the branch touched %j: %s", (brought, touched, tier) => {
    expect(plan.syncTier(brought, touched).tier).toBe(tier);
  });

  it.each([
    ["packages/data/src/db/migrations/0100_x.sql", "a migration"],
    ["packages/data/src/seeds/people.ts", "seeds"],
    ["powersync/sync-config.yaml", "the sync config"],
    ["pnpm-lock.yaml", "the lockfile"],
    ["apps/web/package.json", "a package.json"],
    ["vitest.config.ts", "the Vitest config"],
    ["scripts/ci/gate.mjs", "scripts/ci"],
    ["packages/data/test/setup.ts", "test setup"],
    ["apps/web/test/setup.ts", "test setup"],
    ["apps/web/vite.config.ts", "a Vite config"],
    ["tsconfig.base.json", "a TypeScript config"],
    ["packages/api/tsconfig.json", "a TypeScript config"],
    ["pnpm-workspace.yaml", "the pnpm workspace"],
    ["eslint.config.js", "the ESLint config"],
    ["scripts/eslint/plugin.mjs", "the ESLint rules"],
    [".prettierrc.json", "the Prettier config"],
    [".prettierignore", "the Prettier config"],
    ["packages/data/src/seeds/notes.md", null],
    ["scripts/ci/quarantine.txt", null],
    ["scripts/ci/brake-list.txt", null],
    ["apps/web/app/routes/home.tsx", null],
  ])("a dev sync bringing %s brings %s", (file, kind) => {
    expect(plan.riskyKind(file)).toBe(kind);
  });
});

describe("what pnpm test:tooling runs", () => {
  const BASE = ["tooling:unit", "core:unit", "project:unit", "project:tooling"];
  const WITH = [...BASE, "tooling:browser"];

  it.each([
    "scripts/loops/browser.sh",
    "scripts/project/serve.sh",
    "scripts/project/browser-run.sh",
    "scripts/loops/checks",
    "scripts/project/check-areas.mjs",
    "scripts/loops/check-areas.d/timeline",
    "scripts/browser-checks/fixtures.mjs",
  ])("adds the browser harness for %s", (f) => {
    expect(toolingProjects(["docs/x.md", f])).toEqual(WITH);
  });

  it.each([
    "scripts/loops/land.sh",
    "scripts/loops/checks.mjs",
    "scripts/backlog/backlog.mjs",
    ".githooks/commit-msg",
  ])("skips it for %s", (f) => expect(toolingProjects([f])).toEqual(BASE));
});
