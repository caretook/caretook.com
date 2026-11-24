// The deploy Actions (hosting slice 5), read as YAML: they parse, the deploy
// runs its steps in the agreed order, every secret they name is one the
// deploy env check knows (or a CI-only one), the CLIs come from the one
// pinned-versions file, and inputs never reach a shell unquoted. Parsed with
// the sync config's YAML reader (no YAML dependency), which refuses what it
// doesn't know, so the workflows stay plain.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { DEPLOY_ENV_VARIABLES } from "../../apps/web/app/.server/deployEnv.ts";
import { parseYaml } from "../../packages/data/src/db/roles/syncConfig.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8");

const WORKFLOWS = readdirSync(`${root}.github/workflows`)
  .filter((f) => f.endsWith(".yml"))
  .map((f) => `.github/workflows/${f}`);
const ACTIONS = [".github/actions/setup/action.yml"];

/** Secrets only the Actions hold: never a Vercel or server variable. */
const CI_ONLY_SECRETS = ["VERCEL_TOKEN", "POWERSYNC_ADMIN_TOKEN", "MIGRATIONS_DATABASE_URL"];

const secretsIn = (text) => [...new Set([...text.matchAll(/\bsecrets\.([A-Za-z0-9_]+)/g)].map((m) => m[1]))];

/** The comment block at the top of a file, before its first key. */
const header = (text) => text.slice(0, text.search(/^[a-z]/m));

const stepsOf = (workflow) => Object.values(workflow.jobs).flatMap((job) => job.steps ?? []);

describe("the deploy workflows", () => {
  it("are all here", () => {
    expect(WORKFLOWS.sort()).toEqual([
      ".github/workflows/admin-grant.yml",
      ".github/workflows/ci.yml",
      ".github/workflows/db-access.yml",
      ".github/workflows/deploy.yml",
      ".github/workflows/reset-staging.yml",
      ".github/workflows/rotate-jwks.yml",
      ".github/workflows/seed-staging.yml",
    ]);
  });

  it.each([...WORKFLOWS, ...ACTIONS])("%s parses", (path) => {
    const doc = parseYaml(read(path));
    expect(doc).toBeTypeOf("object");
    if (path.includes("/workflows/")) {
      expect(doc).toHaveProperty("on");
      expect(Object.keys(doc.jobs).length).toBeGreaterThan(0);
      for (const step of stepsOf(doc)) expect(step.run ?? step.uses).toBeTruthy();
    }
  });

  it("deploys on pushes to staging and main, one at a time per environment", () => {
    const deploy = parseYaml(read(".github/workflows/deploy.yml"));
    // Only those two branches ever deploy: no previews for dev, prd/ or PRs (B-243).
    expect(Object.keys(deploy.on)).toEqual(["push"]);
    expect(Object.keys(deploy.on.push)).toEqual(["branches"]);
    expect(deploy.on.push.branches).toEqual(["staging", "main"]);
    expect(deploy.concurrency.group).toMatch(/production.*staging/);
    expect(deploy.concurrency["cancel-in-progress"]).toBe("false");
    expect(deploy.jobs.deploy.environment).toMatch(/main.*production.*staging/);
  });

  it.each(WORKFLOWS.filter((p) => !/\/(deploy|ci)\.yml$/.test(p)))("%s runs only by hand", (path) => {
    expect(Object.keys(parseYaml(read(path)).on)).toEqual(["workflow_dispatch"]);
  });

  it("runs CI only on a push to a ci/ ref, reading no secret", () => {
    const text = read(".github/workflows/ci.yml");
    const ci = parseYaml(text);
    expect(Object.keys(ci.on)).toEqual(["push"]);
    expect(ci.on.push).toEqual({ branches: ["ci/**"] });
    expect(secretsIn(text)).toEqual([]);
    expect(text).not.toMatch(/\bsecrets\b(?!: none)/);
    expect(ci.permissions).toEqual({ contents: "read" });
    expect(ci.concurrency["cancel-in-progress"]).toBe("true");
  });

  it("checks CI out by the pushed SHA and keeps the job's token out of the checkout", () => {
    const ci = parseYaml(read(".github/workflows/ci.yml"));
    for (const job of Object.values(ci.jobs)) {
      const checkout = job.steps.find((s) => s.id === "checkout");
      expect(checkout.with.ref).toBe("${{ github.sha }}");
      expect(checkout.with["persist-credentials"]).toBe("false");
    }
  });

  it("runs the browser tooling project in CI's integration job, not its unit job", () => {
    const { jobs } = parseYaml(read(".github/workflows/ci.yml"));
    const unit = jobs.unit.steps.find((s) => s.id === "test").run;
    expect(unit).toContain("--project tooling:unit");
    expect(unit).not.toContain("tooling:browser");
    // The real project split: a pattern Vitest ignores fails here.
    const list = (project) =>
      execFileSync("pnpm", ["exec", "vitest", "list", "--filesOnly", "--project", project], {
        cwd: root,
        encoding: "utf8",
      });
    expect(list("tooling:unit")).not.toContain("loops/browser.test.mjs");
    expect(list("tooling:unit")).toContain("loops/lease.test.mjs");
    expect(
      list("tooling:browser")
        .trim()
        .split("\n")
        .filter((l) => l.includes(".test.")),
    ).toHaveLength(1);
    const step = jobs.integration.steps.find((s) => s.id === "browser-tooling");
    expect(step.run).toContain("--project tooling:browser");
    expect(step.if).toBe("${{ !cancelled() }}");
    const report = jobs.integration.steps.find((s) => s.id === "report").run;
    expect(report).toContain("ci-results/browser-tooling.json");
  }, 60_000);

  it("gates CI's jobs on the tier and always writes a verdict unless cancelled", () => {
    const { jobs } = parseYaml(read(".github/workflows/ci.yml"));
    const tierOf = {
      static: "static",
      unit: "unit",
      integration: "integration",
      "components-1": "components",
      "components-2": "components",
      build: "full",
      browser: "candidate",
      "browser-2": "release",
      "browser-3": "release",
      "zone-browser": "release",
      "zone-components-1": "release",
      "zone-components-2": "release",
    };
    const tierJobs = Object.keys(tierOf);
    expect([...Object.keys(jobs)].sort()).toEqual(["plan", ...tierJobs, "verdict"].sort());
    // A narrowed run has one components job, so the second shard has its own switch.
    const switchOf = { ...tierOf, "components-2": "components2" };
    for (const name of tierJobs)
      expect(jobs[name].if).toBe(`\${{ needs.plan.outputs.${switchOf[name]} == 'true' }}`);
    expect(jobs.verdict.if).toBe("${{ !cancelled() }}");
    expect([...jobs.verdict.needs].sort()).toEqual(["plan", ...tierJobs].sort());
    const upload = jobs.verdict.steps.at(-1);
    expect(upload.uses).toMatch(/^actions\/upload-artifact@[0-9a-f]{40}$/);
    expect(upload.with).toMatchObject({ name: "verdict", "retention-days": "7" });
    expect(jobs.integration.services.postgres.ports).toEqual(["5435:5432"]);
  });

  it.each([1, 2])("runs CI's component shard %i in Chromium and reports it", (n) => {
    const job = parseYaml(read(".github/workflows/ci.yml")).jobs[`components-${n}`];
    const run = (id) => job.steps.find((s) => s.id === id).run;
    expect(run("chromium")).toBe("pnpm exec playwright install --with-deps chromium");
    // Both zones' component projects: the second zone every day for its screens (B-372).
    expect(run("test")).toContain(`--project web:components --project web:components:ny --shard=${n}/2`);
    expect(run("test")).toContain(`--outputFile.json=ci-results/components-${n}.json`);
    expect(run("report")).toContain(`ci-results/components-${n}.json`);
  });

  it("reruns through the test job, with quarantine steps that can't fail the run", () => {
    const { jobs } = parseYaml(read(".github/workflows/ci.yml"));
    for (const name of ["unit", "integration", "components-1", "components-2"])
      expect(jobs[name].steps.find((s) => s.id === "test").run).toMatch(/^node scripts\/ci\/test-job\.mjs /);
    for (const [name, id] of [
      ["unit", "quarantine"],
      ["integration", "quarantine"],
      ["integration", "quarantine-browser"],
      ["components-1", "quarantine"],
    ]) {
      const step = jobs[name].steps.find((s) => s.id === id);
      expect(step.run).toContain("test-job.mjs --quarantine");
      expect(step["continue-on-error"]).toBe("true");
    }
    // One shard runs the quarantined component tests, not both.
    expect(jobs["components-2"].steps.some((s) => s.id === "quarantine")).toBe(false);
    for (const name of ["static", "build", "browser"])
      expect(jobs[name].outputs.started).toContain("steps.started");
  });

  it("builds both targets in CI's full tier, with no debug handle in either client", () => {
    const { build } = parseYaml(read(".github/workflows/ci.yml")).jobs;
    const run = (id) => build.steps.find((s) => s.id === id).run;
    expect(run("env")).toBe('node scripts/ci/env.mjs build >> "$GITHUB_ENV"');
    expect(run("budget")).toBe("pnpm build:budget");
    expect(run("native")).toBe("pnpm build:native");
    for (const dir of ["apps/web/build/web/client", "apps/web/build/native/client"])
      expect(run("grep")).toContain(dir);
    expect(run("grep")).toContain("caretookSync");
  });

  it("runs the browser suite on the Docker stack, against a check build it serves itself", () => {
    const { browser } = parseYaml(read(".github/workflows/ci.yml")).jobs;
    expect(Number(browser["timeout-minutes"])).toBeLessThanOrEqual(35);
    expect(browser.services).toBeUndefined();
    expect(browser.steps.map((s) => s.id)).toEqual([
      "checkout",
      "setup",
      "env",
      "chromium",
      "stack",
      "migrate",
      "seed",
      "build",
      "serve",
      "powersync",
      "started",
      "suite",
      "report",
      "logs",
    ]);
    const run = (id) => browser.steps.find((s) => s.id === id).run;
    expect(run("env")).toContain('node scripts/ci/env.mjs browser >> "$GITHUB_ENV"');
    expect(run("stack")).toBe("pnpm datastore:up");
    expect(run("serve")).toContain("NODE_ENV=production");
    expect(run("serve")).toContain("host-headers.mjs");
    expect(run("suite")).toBe("node scripts/ci/browser-job.mjs");
    expect(run("report")).toBe('node scripts/ci/browser-job.mjs report >> "$GITHUB_OUTPUT"');
    expect(browser.outputs.failures).toBe("${{ steps.report.outputs.failures }}");
    expect(browser.steps.find((s) => s.id === "report").if).toContain("!cancelled()");
  });

  it("runs the check-areas lint in CI's static job", () => {
    const { jobs } = parseYaml(read(".github/workflows/ci.yml"));
    const step = jobs.static.steps.find((s) => s.id === "check-areas");
    expect(step.run).toBe("node scripts/loops/check-areas.mjs lint");
    expect(step.if).toBe("${{ !cancelled() }}");
  });

  it("gives each release suite run its own job, within one suite's limit", () => {
    const { jobs } = parseYaml(read(".github/workflows/ci.yml"));
    const capS = read("scripts/loops/checks")
      .split("\n")
      .filter((line) => !line.startsWith("#"))
      .map((line) => line.trim().split(/\s+/))
      .filter((f) => f[3] === "yes")
      .reduce((sum, f) => sum + Number(f[1]), 0);
    for (const name of ["browser", "browser-2", "browser-3", "zone-browser"]) {
      const job = jobs[name];
      expect(Number(job["timeout-minutes"])).toBeLessThanOrEqual(35);
      expect(capS).toBeLessThan((Number(job["timeout-minutes"]) - 3) * 60);
      expect(job.steps.filter((s) => s.id === "suite")).toHaveLength(1);
      expect(job.steps.find((s) => s.id === "suite").run).toBe("node scripts/ci/browser-job.mjs");
    }
    const same = (name) => jobs[name].steps.map((s) => ({ ...s }));
    expect(same("browser-2")).toEqual(same("browser"));
    expect(same("browser-3")).toEqual(same("browser"));
    const zoneSteps = same("zone-browser").map((s) =>
      s.id === "env"
        ? { ...s, run: s.run.replace('node scripts/ci/env.mjs zone >> "$GITHUB_ENV"\n', "") }
        : s,
    );
    expect(zoneSteps).toEqual(same("browser"));
    for (const name of ["zone-browser", "zone-components-1", "zone-components-2"])
      expect(jobs[name].steps.find((s) => s.id === "env").run).toContain("env.mjs zone");
  });

  it("runs the deploy's steps in order", () => {
    const deploy = parseYaml(read(".github/workflows/deploy.yml"));
    const steps = deploy.jobs.deploy.steps;
    expect(steps.map((s) => s.id)).toEqual([
      "checkout",
      "setup",
      "env",
      "migrate",
      "roles",
      "powersync",
      "vercel-pull",
      "vercel-build",
      "vercel-deploy",
      "smoke",
    ]);
    const run = Object.fromEntries(steps.map((s) => [s.id, s.run ?? s.uses]));
    expect(run.checkout).toMatch(/^actions\/checkout@[0-9a-f]{40}$/);
    expect(run.setup).toBe("./.github/actions/setup");
    expect(run.env).toBe('pnpm deploy:env "$DEPLOY_TARGET"');
    expect(run.migrate).toBe("pnpm datastore:migrate");
    expect(run.roles).toBe("pnpm db:roles");
    expect(run.powersync).toMatch(/pnpm dlx "\$POWERSYNC_CLI" deploy sync-config .*--instance-id/);
    expect(run["vercel-pull"]).toMatch(/^pnpm dlx "\$VERCEL_CLI" pull --yes --environment=production /);
    expect(run["vercel-build"]).toMatch(/^pnpm dlx "\$VERCEL_CLI" build --prod /);
    expect(run["vercel-deploy"]).toMatch(/^pnpm dlx "\$VERCEL_CLI" deploy --prebuilt --prod /);
    expect(run.smoke).toBe('pnpm deploy:smoke "$DEPLOY_TARGET"');
  });

  it("migrates and applies roles as the migrations role, in a deployed APP_ENV", () => {
    const steps = parseYaml(read(".github/workflows/deploy.yml")).jobs.deploy.steps;
    for (const id of ["migrate", "roles"]) {
      const { env } = steps.find((s) => s.id === id);
      expect(env.MIGRATIONS_DATABASE_URL).toBe("${{ secrets.MIGRATIONS_DATABASE_URL }}");
      expect(env.APP_ENV).toBeTruthy();
      expect(env.DATABASE_URL).toBeUndefined();
    }
  });

  it("gives the env check every variable it knows", () => {
    const steps = parseYaml(read(".github/workflows/deploy.yml")).jobs.deploy.steps;
    const { env } = steps.find((s) => s.id === "env");
    expect(Object.keys(env).sort()).toEqual([...DEPLOY_ENV_VARIABLES].sort());
  });

  it.each(WORKFLOWS)("%s names only secrets the env check knows or CI-only ones", (path) => {
    const known = new Set([...DEPLOY_ENV_VARIABLES, ...CI_ONLY_SECRETS]);
    const text = read(path);
    expect(secretsIn(text).filter((name) => !known.has(name))).toEqual([]);
    // Only `secrets.NAME`: no `secrets[...]` or the whole `secrets` object.
    expect(text).not.toMatch(/\bsecrets\s*\[|toJSON\(secrets\)/);
  });

  it.each(WORKFLOWS)("%s lists its secrets at the top", (path) => {
    const text = read(path);
    const top = header(text);
    expect(top).toMatch(/^# Secrets/m);
    for (const name of secretsIn(text)) expect(top).toMatch(new RegExp(`\\b${name}\\b`));
  });

  it.each([...WORKFLOWS, ...ACTIONS])("%s keeps expressions out of shell scripts", (path) => {
    // Inputs and secrets reach a script only through env (quoted "$VAR"), never `${{ }}` in `run`.
    const doc = parseYaml(read(path));
    const steps = path.includes("/workflows/") ? stepsOf(doc) : doc.runs.steps;
    for (const step of steps) if (step.run) expect(step.run).not.toContain("${{");
  });

  it.each([...WORKFLOWS, ...ACTIONS])("%s pins every third-party action to a commit", (path) => {
    const doc = parseYaml(read(path));
    const steps = path.includes("/workflows/") ? stepsOf(doc) : doc.runs.steps;
    for (const { uses } of steps) {
      if (!uses || uses.startsWith("./")) continue;
      expect(uses).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
    }
  });

  it("seeds staging only, and grants run in the chosen environment", () => {
    expect(parseYaml(read(".github/workflows/seed-staging.yml")).jobs.seed.environment).toBe("staging");
    // The reset is staging's alone too, behind a typed confirmation, and never beside a seed run.
    const reset = parseYaml(read(".github/workflows/reset-staging.yml"));
    expect(reset.jobs.reset.environment).toBe("staging");
    expect(reset.jobs.reset.if).toContain("inputs.confirm == 'staging'");
    expect(reset.on.workflow_dispatch.inputs.confirm.required).toBe("true");
    expect(reset.concurrency.group).toBe("seed-staging");
    expect(reset.jobs.reset.steps.at(-1).env.APP_ENV).toBe("staging");
    for (const path of [
      ".github/workflows/admin-grant.yml",
      ".github/workflows/db-access.yml",
      ".github/workflows/rotate-jwks.yml",
    ]) {
      const doc = parseYaml(read(path));
      expect(doc.on.workflow_dispatch.inputs.environment.options).toEqual(["staging", "production"]);
    }
  });
});

describe("the pinned CLI versions", () => {
  const versions = Object.fromEntries(
    read(".github/cli-versions.env")
      .split("\n")
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => line.split("=")),
  );

  it("are exact", () => {
    expect(Object.keys(versions).sort()).toEqual(["POWERSYNC_CLI", "VERCEL_CLI"]);
    expect(versions.VERCEL_CLI).toMatch(/^vercel@\d+\.\d+\.\d+$/);
    expect(versions.POWERSYNC_CLI).toMatch(/^powersync@\d+\.\d+\.\d+$/);
  });

  it("are read by the setup action", () => {
    expect(read(".github/actions/setup/action.yml")).toContain(".github/cli-versions.env");
  });

  it.each(WORKFLOWS)("are the only CLI versions %s uses", (path) => {
    for (const [, command] of read(path).matchAll(/pnpm dlx (\S+)/g))
      expect(command).toMatch(/^"\$[A-Z_]+_CLI"$/);
  });
});

describe("vercel.json", () => {
  const config = JSON.parse(read("apps/web/vercel.json"));

  it("turns Vercel's Git deploys off (the Action deploys)", () => {
    expect(config.git).toEqual({ deploymentEnabled: false });
  });

  it("keeps the region, the outbox cron and the headers", () => {
    expect(config.regions).toEqual(["cle1"]);
    expect(config.crons).toEqual([
      { path: "/api/cron/outbox", schedule: "* * * * *" },
      { path: "/api/cron/calendar", schedule: "* * * * *" },
    ]);
    expect(config.headers.length).toBeGreaterThanOrEqual(2);
  });
});
