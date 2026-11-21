// The deploy Actions (hosting slice 5), read as YAML: they parse, the deploy
// runs its steps in the agreed order, every secret they name is one the
// deploy env check knows (or a CI-only one), the CLIs come from the one
// pinned-versions file, and inputs never reach a shell unquoted. Parsed with
// the sync config's YAML reader (no YAML dependency), which refuses what it
// doesn't know, so the workflows stay plain.
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
      ".github/workflows/db-access.yml",
      ".github/workflows/deploy.yml",
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

  it.each(WORKFLOWS.filter((p) => !p.endsWith("/deploy.yml")))("%s runs only by hand", (path) => {
    expect(Object.keys(parseYaml(read(path)).on)).toEqual(["workflow_dispatch"]);
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
