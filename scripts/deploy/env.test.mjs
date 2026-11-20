// pnpm deploy:env (hosting slice 1): the CLI around checkDeployEnv, run as the
// deploy Action runs it. The rules themselves are unit-tested beside the module.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const CLI = fileURLToPath(new URL("./env.mjs", import.meta.url));

const run = (args, env) =>
  spawnSync(process.execPath, [CLI, ...args], { env: { PATH: process.env.PATH, ...env }, encoding: "utf8" });

const SECRET = "s".repeat(44);
const STAGING = {
  APP_ENV: "staging",
  APP_URL: "https://staging.caretook.com",
  BETTER_AUTH_URL: "https://staging.caretook.com",
  BETTER_AUTH_SECRET: SECRET,
  DATABASE_URL: "postgresql://caretook_app:pw@ep-fictional-1-pooler.us-east-2.aws.neon.tech/caretook",
  POWERSYNC_URL: "https://fictional.powersync.journeyapps.com",
  VITE_POWERSYNC_URL: "https://fictional.powersync.journeyapps.com",
  MAIL_SENDER: "resend",
  RESEND_API_KEY: "re_fictional",
  MAIL_FROM: "Caretook <no-reply@mail.caretook.com>",
  SUPPORT_EMAIL: "support@caretook.com",
  CRON_SECRET: SECRET,
  INVITE_LINK_KEY: SECRET,
  RESEND_WEBHOOK_SECRET: `whsec_${"w".repeat(32)}`,
  MAIL_ALLOWLIST: "@caretook.com",
  SEED_USER_PASSWORD: "a-long-fictional-staging-password",
  CLIENT_IP_HEADER: "x-vercel-forwarded-for",
};

describe("pnpm deploy:env", () => {
  it("exits 0 for a complete environment", () => {
    const res = run(["staging"], STAGING);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("complete");
  });

  it("exits 1 for an incomplete one, printing variable names and never values", () => {
    const { RESEND_API_KEY: _key, ...rest } = STAGING;
    const res = run(["staging"], {
      ...rest,
      CRON_SECRET: "tiny-fictional-cron",
      SEED_USER_PASSWORD: "caretook-dev-password",
    });
    expect(res.status).toBe(1);
    const out = res.stdout + res.stderr;
    for (const name of ["RESEND_API_KEY", "CRON_SECRET", "SEED_USER_PASSWORD"]) expect(out).toContain(name);
    for (const secret of ["tiny-fictional-cron", "caretook-dev-password", SECRET, "re_fictional", "pw@"]) {
      expect(out).not.toContain(secret);
    }
  });

  it("checks the target it's given", () => {
    const res = run(["production"], STAGING);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("APP_ENV");
  });

  it("refuses an unknown target", () => {
    expect(run([], STAGING).status).toBe(2);
    expect(run(["prod"], STAGING).status).toBe(2);
  });
});
