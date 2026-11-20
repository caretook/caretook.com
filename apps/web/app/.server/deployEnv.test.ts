import { afterEach, describe, expect, it } from "vitest";

import { DEV_SEED_PASSWORD as SEED_DEFAULT } from "../../../../packages/data/src/db/seeds/guard";
import {
  checkDeployEnv,
  DEPLOY_ENV_VARIABLES,
  deployEnvRefusal,
  DEV_SEED_PASSWORD,
  formatDeployEnvProblems,
  resetDeployEnvCheck,
  serverDeployEnvProblems,
  type DeployTarget,
} from "./deployEnv";

// Fictional values throughout: long enough, on the right hosts.
const SECRET = "s".repeat(44);

const base = (target: DeployTarget) => {
  const origin = target === "production" ? "https://caretook.com" : "https://staging.caretook.com";
  return {
    APP_ENV: target,
    APP_URL: origin,
    BETTER_AUTH_URL: origin,
    BETTER_AUTH_SECRET: SECRET,
    DATABASE_URL: "postgresql://caretook_app:pw@ep-fictional-123-pooler.us-east-2.aws.neon.tech/caretook",
    MIGRATIONS_DATABASE_URL:
      "postgresql://caretook_migrations:pw@ep-fictional-123.us-east-2.aws.neon.tech/caretook",
    POWERSYNC_URL: "https://fictional.powersync.journeyapps.com",
    VITE_POWERSYNC_URL: "https://fictional.powersync.journeyapps.com",
    MAIL_SENDER: "resend",
    RESEND_API_KEY: "re_fictional",
    MAIL_FROM: "Caretook <no-reply@mail.caretook.com>",
    SUPPORT_EMAIL: "support@caretook.com",
    CRON_SECRET: SECRET,
    INVITE_LINK_KEY: SECRET,
    RESEND_WEBHOOK_SECRET: `whsec_${"w".repeat(32)}`,
    CLIENT_IP_HEADER: "x-vercel-forwarded-for",
  } as Record<string, string | undefined>;
};
const valid = {
  production: base("production"),
  staging: {
    ...base("staging"),
    MAIL_ALLOWLIST: "@caretook.com",
    SEED_USER_PASSWORD: "a-long-fictional-staging-password",
  },
};

const TARGETS = ["production", "staging"] as const;

/** The variables with problems, for `env` (the valid one with `changes`). */
const problemsFor = (target: DeployTarget, changes: Record<string, string | undefined>) =>
  checkDeployEnv(target, { ...valid[target], ...changes });
const variables = (target: DeployTarget, changes: Record<string, string | undefined>) =>
  problemsFor(target, changes).map((p) => p.variable);

describe("checkDeployEnv", () => {
  it.each(TARGETS)("passes a complete %s environment", (target) => {
    expect(checkDeployEnv(target, valid[target])).toEqual([]);
  });

  it.each(TARGETS)("names every required variable that's missing or blank (%s)", (target) => {
    const required = [
      "APP_ENV",
      "APP_URL",
      "BETTER_AUTH_SECRET",
      "BETTER_AUTH_URL",
      "DATABASE_URL",
      "POWERSYNC_URL",
      "VITE_POWERSYNC_URL",
      "MAIL_SENDER",
      "RESEND_API_KEY",
      "MAIL_FROM",
      "SUPPORT_EMAIL",
      "CRON_SECRET",
      "INVITE_LINK_KEY",
      "RESEND_WEBHOOK_SECRET",
      "CLIENT_IP_HEADER",
      ...(target === "staging" ? ["MAIL_ALLOWLIST", "SEED_USER_PASSWORD"] : []),
    ];
    for (const name of required) {
      expect(problemsFor(target, { [name]: undefined })).toContainEqual({
        variable: name,
        problem: "is not set",
      });
      expect(variables(target, { [name]: "  " })).toContain(name);
    }
    const none = checkDeployEnv(target, {});
    expect(none.map((p) => p.variable).sort()).toEqual([...required].sort());
  });

  it("knows every variable it checks", () => {
    for (const name of Object.keys(valid.staging)) expect(DEPLOY_ENV_VARIABLES).toContain(name);
    expect(DEPLOY_ENV_VARIABLES).toContain("NATIVE_APP_ORIGINS");
  });

  it.each(TARGETS)("takes an optional BETTER_AUTH_SECRETS list of long, versioned secrets (%s)", (target) => {
    const other = "t".repeat(44);
    expect(DEPLOY_ENV_VARIABLES).toContain("BETTER_AUTH_SECRETS");
    expect(variables(target, { BETTER_AUTH_SECRETS: `2:${other}, 1:${SECRET}` })).toEqual([]);
    expect(problemsFor(target, { BETTER_AUTH_SECRETS: `2:${other},${SECRET}` })).toEqual([
      { variable: "BETTER_AUTH_SECRETS", problem: "entry 2 must be <version>:<secret>" },
    ]);
    expect(problemsFor(target, { BETTER_AUTH_SECRETS: `1:${other},01:${SECRET}` })).toEqual([
      { variable: "BETTER_AUTH_SECRETS", problem: "entry 2 repeats version 01" },
    ]);
    expect(problemsFor(target, { BETTER_AUTH_SECRETS: "1:short" })).toEqual([
      { variable: "BETTER_AUTH_SECRETS", problem: "entry 1 must be at least 32 characters" },
    ]);
    // Names only, never the value.
    const lines = formatDeployEnvProblems(problemsFor(target, { BETTER_AUTH_SECRETS: "1:short" }));
    expect(lines.join("\n")).not.toContain("short");
  });

  it.each(TARGETS)("needs CLIENT_IP_HEADER to be one header name (%s)", (target) => {
    expect(variables(target, { CLIENT_IP_HEADER: "X-Vercel-Forwarded-For" })).toEqual([]);
    for (const bad of ["x-vercel-forwarded-for, x-forwarded-for", "x vercel", "x-real-ip:"])
      expect(variables(target, { CLIENT_IP_HEADER: bad }), bad).toEqual(["CLIENT_IP_HEADER"]);
  });

  it.each(TARGETS)("takes NATIVE_APP_ORIGINS unset or 1, nothing else (%s)", (target) => {
    expect(variables(target, { NATIVE_APP_ORIGINS: undefined })).toEqual([]);
    expect(variables(target, { NATIVE_APP_ORIGINS: "" })).toEqual([]);
    expect(variables(target, { NATIVE_APP_ORIGINS: "1" })).toEqual([]);
    for (const bad of ["0", "true", "yes", "capacitor://localhost"])
      expect(variables(target, { NATIVE_APP_ORIGINS: bad }), bad).toEqual(["NATIVE_APP_ORIGINS"]);
  });

  it.each(TARGETS)("needs APP_ENV to name the target (%s)", (target) => {
    const other = target === "production" ? "staging" : "production";
    expect(variables(target, { APP_ENV: other })).toContain("APP_ENV");
  });

  describe("APP_URL", () => {
    it.each(TARGETS)("is https on the target's host, with no path (%s)", (target) => {
      const host = target === "production" ? "caretook.com" : "staging.caretook.com";
      const wrongHost = target === "production" ? "staging.caretook.com" : "caretook.com";
      for (const url of [
        `http://${host}`,
        `https://${wrongHost}`,
        `https://www.${host}`,
        `https://${host}:8443`,
        `https://${host}/app`,
        "not a url",
      ]) {
        expect(variables(target, { APP_URL: url, BETTER_AUTH_URL: url }), url).toContain("APP_URL");
      }
      expect(variables(target, { APP_URL: `https://${host}/`, BETTER_AUTH_URL: `https://${host}` })).toEqual(
        [],
      );
    });

    it.each(TARGETS)("is what BETTER_AUTH_URL says too (%s)", (target) => {
      expect(variables(target, { BETTER_AUTH_URL: "https://other.caretook.com" })).toEqual([
        "BETTER_AUTH_URL",
      ]);
    });
  });

  it.each(TARGETS)("needs POWERSYNC_URL https and equal to VITE_POWERSYNC_URL (%s)", (target) => {
    expect(variables(target, { VITE_POWERSYNC_URL: "https://elsewhere.powersync.journeyapps.com" })).toEqual([
      "VITE_POWERSYNC_URL",
    ]);
    expect(
      variables(target, {
        POWERSYNC_URL: "http://localhost:8080",
        VITE_POWERSYNC_URL: "http://localhost:8080",
      }),
    ).toEqual(["POWERSYNC_URL"]);
  });

  describe("email", () => {
    it.each(TARGETS)("sends with Resend (%s)", (target) => {
      expect(variables(target, { MAIL_SENDER: "log" })).toEqual(["MAIL_SENDER"]);
      expect(variables(target, { MAIL_SENDER: "memory" })).toEqual(["MAIL_SENDER"]);
      expect(variables(target, { RESEND_API_KEY: "" })).toEqual(["RESEND_API_KEY"]);
    });

    it.each(TARGETS)("sends from a mail. subdomain (%s)", (target) => {
      expect(variables(target, { MAIL_FROM: "Caretook <no-reply@caretook.com>" })).toEqual(["MAIL_FROM"]);
      expect(variables(target, { MAIL_FROM: "Caretook" })).toEqual(["MAIL_FROM"]);
      expect(variables(target, { MAIL_FROM: "no-reply@mail.caretook.com" })).toEqual([]);
    });

    it.each(TARGETS)("has a real support address (%s)", (target) => {
      expect(variables(target, { SUPPORT_EMAIL: "support@example.com" })).toEqual(["SUPPORT_EMAIL"]);
      expect(variables(target, { SUPPORT_EMAIL: "support" })).toEqual(["SUPPORT_EMAIL"]);
    });

    it("mails only the allowlist on staging, and everyone in production", () => {
      expect(variables("staging", { MAIL_ALLOWLIST: "" })).toEqual(["MAIL_ALLOWLIST"]);
      expect(variables("production", { MAIL_ALLOWLIST: "@caretook.com" })).toEqual(["MAIL_ALLOWLIST"]);
      expect(variables("production", { MAIL_ALLOWLIST: "" })).toEqual([]);
    });
  });

  describe("secrets", () => {
    it.each(TARGETS)("are long enough (%s)", (target) => {
      for (const name of ["BETTER_AUTH_SECRET", "CRON_SECRET", "INVITE_LINK_KEY"]) {
        expect(variables(target, { [name]: "short" })).toEqual([name]);
        expect(variables(target, { [name]: "x".repeat(31) })).toEqual([name]);
        expect(variables(target, { [name]: "x".repeat(32) })).toEqual([]);
      }
    });

    it.each(TARGETS)("include a Svix webhook secret (%s)", (target) => {
      expect(variables(target, { RESEND_WEBHOOK_SECRET: "w".repeat(40) })).toEqual(["RESEND_WEBHOOK_SECRET"]);
      expect(variables(target, { RESEND_WEBHOOK_SECRET: "whsec_short" })).toEqual(["RESEND_WEBHOOK_SECRET"]);
    });
  });

  describe("DATABASE_URL", () => {
    it.each(TARGETS)("goes through Neon's pooler (%s)", (target) => {
      expect(
        variables(target, {
          DATABASE_URL: "postgresql://caretook_app:pw@ep-fictional-123.us-east-2.aws.neon.tech/caretook",
        }),
      ).toEqual(["DATABASE_URL"]);
      expect(variables(target, { DATABASE_URL: "mysql://x@y-pooler.z/db" })).toEqual(["DATABASE_URL"]);
    });

    it.each(TARGETS)("isn't the migrations role (%s)", (target) => {
      const asMigrations =
        "postgresql://caretook_migrations:pw@ep-fictional-123-pooler.us-east-2.aws.neon.tech/caretook";
      expect(variables(target, { DATABASE_URL: asMigrations })).toEqual(["DATABASE_URL"]);
      // Without MIGRATIONS_DATABASE_URL (the server's env), the role's name still gives it away.
      expect(variables(target, { DATABASE_URL: asMigrations, MIGRATIONS_DATABASE_URL: undefined })).toEqual([
        "DATABASE_URL",
      ]);
      // A differently named migrations role, matched through MIGRATIONS_DATABASE_URL.
      expect(
        variables(target, {
          DATABASE_URL: "postgresql://owner:pw@ep-fictional-123-pooler.us-east-2.aws.neon.tech/caretook",
          MIGRATIONS_DATABASE_URL: "postgresql://owner:pw@ep-fictional-123.us-east-2.aws.neon.tech/caretook",
        }),
      ).toEqual(["DATABASE_URL"]);
    });
  });

  describe("SEED_USER_PASSWORD", () => {
    it("is the seed's dev default here too", () => {
      expect(DEV_SEED_PASSWORD).toBe(SEED_DEFAULT);
    });

    it("is set on staging, and not the dev default", () => {
      expect(variables("staging", { SEED_USER_PASSWORD: DEV_SEED_PASSWORD })).toEqual(["SEED_USER_PASSWORD"]);
      expect(variables("staging", { SEED_USER_PASSWORD: "short" })).toEqual(["SEED_USER_PASSWORD"]);
    });

    it("isn't needed in production, or by the staging server (the seed runs in the Action)", () => {
      expect(variables("production", { SEED_USER_PASSWORD: undefined })).toEqual([]);
      expect(
        checkDeployEnv("staging", { ...valid.staging, SEED_USER_PASSWORD: undefined }, { scope: "server" }),
      ).toEqual([]);
    });
  });

  it("never puts a value in a problem", () => {
    const env = Object.fromEntries(Object.keys(valid.staging).map((name) => [name, `value-of-${name}-xyz`]));
    const lines = formatDeployEnvProblems(checkDeployEnv("staging", env)).join("\n");
    expect(lines).not.toMatch(/value-of-/);
  });
});

describe("serverDeployEnvProblems", () => {
  it("checks nothing when APP_ENV is unset (dev, tests, check builds)", () => {
    expect(serverDeployEnvProblems({})).toEqual([]);
    expect(serverDeployEnvProblems({ APP_ENV: " " })).toEqual([]);
  });

  it("refuses an unknown APP_ENV", () => {
    expect(serverDeployEnvProblems({ APP_ENV: "prod" }).map((p) => p.variable)).toEqual(["APP_ENV"]);
  });
});

describe("deployEnvRefusal", () => {
  const page = new Request("https://caretook.com/features");
  afterEach(resetDeployEnvCheck);

  it("serves normally when APP_ENV is unset", () => {
    const logged: string[] = [];
    expect(deployEnvRefusal(page, { NODE_ENV: "production" }, (line) => logged.push(line))).toBeNull();
    expect(logged).toEqual([]);
  });

  it("serves normally with a complete environment", () => {
    expect(deployEnvRefusal(page, { ...valid.production }, () => {})).toBeNull();
  });

  it("answers 503 and logs the variables' names, never their values, once", async () => {
    const logged: string[] = [];
    const env = { ...valid.production, CRON_SECRET: "tiny-secret-value", RESEND_API_KEY: undefined };
    const response = deployEnvRefusal(page, env, (line) => logged.push(line));
    expect(response?.status).toBe(503);
    const body = await response!.text();
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain("CRON_SECRET");
    expect(logged[0]).toContain("RESEND_API_KEY");
    for (const text of [logged[0], body]) {
      expect(text).not.toContain("tiny-secret-value");
      expect(text).not.toContain(SECRET);
    }
    // The body names nothing: the public needn't know what's missing.
    expect(body).not.toContain("CRON_SECRET");

    // Checked once per server: later requests get the same answer, logged once.
    expect(deployEnvRefusal(page, env, (line) => logged.push(line))?.status).toBe(503);
    expect(logged).toHaveLength(1);
  });

  it("lets the build prerender pages without the deploy's secrets", () => {
    const logged: string[] = [];
    const prerender = new Request("http://127.0.0.1:61234/features", {
      headers: { "X-React-Router-Prerender": "yes" },
    });
    const build = { APP_ENV: "staging", IS_RR_BUILD_REQUEST: "yes" };
    expect(deployEnvRefusal(prerender, build, (line) => logged.push(line))).toBeNull();
    expect(logged).toEqual([]);
    // The header alone, on a deployed server, is refused like any request.
    expect(deployEnvRefusal(prerender, { APP_ENV: "staging" }, () => {})?.status).toBe(503);
  });
});
