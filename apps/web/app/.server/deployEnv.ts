// The deploy environment check (hosting slice 1): is this environment
// complete and consistent enough to serve `target`? Pure, and server only
// (it reads secrets). Two callers:
//
//   - `pnpm deploy:env <target>` (scripts/deploy/env.mjs), the deploy
//     Action's first step: it prints the problems and exits 1;
//   - the server itself, when `APP_ENV` is set (`deployEnvRefusal`): it
//     answers 503 until the problems are fixed, so a change made in Vercel's
//     dashboard can't silently break a deploy.
//
// A problem names the variable, never its value. No imports, so Node runs this
// file directly (type stripping) from the CLI.

export const DEPLOY_TARGETS = ["staging", "production"] as const;
export type DeployTarget = (typeof DEPLOY_TARGETS)[number];

export type DeployEnvProblem = { variable: string; problem: string };

type Env = Record<string, string | undefined>;

/** Where the check runs: the deploy Action (every variable) or the server (what the server reads). */
export type DeployEnvScope = "deploy" | "server";

/** The canonical host of each target's `APP_URL`. */
export const TARGET_HOSTS: Record<DeployTarget, string> = {
  production: "caretook.com",
  staging: "staging.caretook.com",
};

/** The seed's dev password (packages/data/.env.example): never a deployed one. */
export const DEV_SEED_PASSWORD = "caretook-dev-password";

/** The dev support address's domain: a deploy mails a real inbox. */
const DEV_SUPPORT_DOMAIN = "example.com";

/** The migrations role (hosting slice 2): DDL rights, held only by the deploy Action. */
export const MIGRATIONS_ROLE = "caretook_migrations";

/** Secrets shorter than this are refused (`openssl rand -base64 32` gives 44). */
export const MIN_SECRET_LENGTH = 32;

/** Every target needs these, on the server and in the Action. */
const REQUIRED = [
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
] as const;

/**
 * Staging also needs these. The seed password is only the Action's (the
 * seed runs there, never on the server), so the server's check skips it.
 */
const REQUIRED_STAGING = ["MAIL_ALLOWLIST"] as const;
const REQUIRED_STAGING_DEPLOY = ["SEED_USER_PASSWORD"] as const;

/** Every variable this check knows (the deploy workflows' secrets are checked against it). */
export const DEPLOY_ENV_VARIABLES: readonly string[] = [
  ...REQUIRED,
  ...REQUIRED_STAGING,
  ...REQUIRED_STAGING_DEPLOY,
  "MIGRATIONS_DATABASE_URL",
];

export const isDeployTarget = (value: string | undefined): value is DeployTarget =>
  (DEPLOY_TARGETS as readonly string[]).includes(value ?? "");

const value = (env: Env, name: string) => env[name]?.trim() ?? "";

const parseUrl = (raw: string): URL | undefined => {
  try {
    return new URL(raw);
  } catch {
    return undefined;
  }
};

/** The address in `Name <a@b>` or `a@b`, lower-cased; undefined if it isn't one. */
const addressOf = (raw: string) => {
  const match = /<([^<>\s]+@[^<>\s]+)>\s*$/.exec(raw) ?? /^([^<>\s]+@[^<>\s]+)$/.exec(raw);
  return match?.[1]?.toLowerCase();
};

const domainOf = (address: string) => address.slice(address.lastIndexOf("@") + 1);

/** An origin with nothing after it: `https://host` (a trailing `/` allowed). */
const isBareOrigin = (url: URL) => url.pathname === "/" && !url.search && !url.hash && !url.username;

const sameUrl = (a: string, b: string) => a.replace(/\/+$/, "") === b.replace(/\/+$/, "");

/**
 * What's wrong with `env` for a deploy to `target`: missing, malformed or
 * inconsistent variables, each named once per problem. Empty means good.
 * `scope: "server"` skips the variables only the deploy Action holds.
 */
export function checkDeployEnv(
  target: DeployTarget,
  env: Env,
  { scope = "deploy" }: { scope?: DeployEnvScope } = {},
): DeployEnvProblem[] {
  const problems: DeployEnvProblem[] = [];
  const problem = (variable: string, text: string) => problems.push({ variable, problem: text });
  const has = (name: string) => value(env, name) !== "";

  const required: string[] = [...REQUIRED];
  if (target === "staging") {
    required.push(...REQUIRED_STAGING);
    if (scope === "deploy") required.push(...REQUIRED_STAGING_DEPLOY);
  }
  for (const name of required) if (!has(name)) problem(name, "is not set");

  // APP_ENV names the target (both run with NODE_ENV=production).
  if (has("APP_ENV") && value(env, "APP_ENV") !== target) problem("APP_ENV", `must be "${target}"`);

  // The origin every link is built from.
  if (has("APP_URL")) {
    const url = parseUrl(value(env, "APP_URL"));
    if (!url) problem("APP_URL", "is not a URL");
    else {
      if (url.protocol !== "https:") problem("APP_URL", "must be https");
      if (url.hostname !== TARGET_HOSTS[target] || url.port)
        problem("APP_URL", `must be on ${TARGET_HOSTS[target]}`);
      if (!isBareOrigin(url)) problem("APP_URL", "must be an origin, with no path");
    }
  }
  if (
    has("APP_URL") &&
    has("BETTER_AUTH_URL") &&
    !sameUrl(value(env, "BETTER_AUTH_URL"), value(env, "APP_URL"))
  )
    problem("BETTER_AUTH_URL", "must equal APP_URL");

  // PowerSync: the server's JWT audience and the browser's endpoint are one URL.
  if (has("POWERSYNC_URL")) {
    const url = parseUrl(value(env, "POWERSYNC_URL"));
    if (!url) problem("POWERSYNC_URL", "is not a URL");
    else if (url.protocol !== "https:") problem("POWERSYNC_URL", "must be https");
  }
  if (
    has("POWERSYNC_URL") &&
    has("VITE_POWERSYNC_URL") &&
    !sameUrl(value(env, "POWERSYNC_URL"), value(env, "VITE_POWERSYNC_URL"))
  )
    problem("VITE_POWERSYNC_URL", "must equal POWERSYNC_URL");

  // Email.
  if (has("MAIL_SENDER") && value(env, "MAIL_SENDER") !== "resend")
    problem("MAIL_SENDER", 'must be "resend"');
  if (has("MAIL_FROM")) {
    const address = addressOf(value(env, "MAIL_FROM"));
    if (!address) problem("MAIL_FROM", "is not an email address");
    else if (!domainOf(address).startsWith("mail.")) problem("MAIL_FROM", "must send from a mail. subdomain");
  }
  if (has("SUPPORT_EMAIL")) {
    const address = addressOf(value(env, "SUPPORT_EMAIL"));
    if (!address) problem("SUPPORT_EMAIL", "is not an email address");
    else if (domainOf(address) === DEV_SUPPORT_DOMAIN) problem("SUPPORT_EMAIL", "is the dev default");
  }
  // Staging mails only the allowlist; production mails everyone, so an
  // allowlist there would be a staging setting copied by mistake.
  if (target === "production" && has("MAIL_ALLOWLIST"))
    problem("MAIL_ALLOWLIST", "must be empty in production");

  // Secrets.
  for (const name of ["BETTER_AUTH_SECRET", "CRON_SECRET", "INVITE_LINK_KEY"]) {
    if (has(name) && value(env, name).length < MIN_SECRET_LENGTH)
      problem(name, `must be at least ${MIN_SECRET_LENGTH} characters`);
  }
  if (has("RESEND_WEBHOOK_SECRET")) {
    const secret = value(env, "RESEND_WEBHOOK_SECRET");
    if (!secret.startsWith("whsec_")) problem("RESEND_WEBHOOK_SECRET", "must start with whsec_");
    else if (secret.length - "whsec_".length < MIN_SECRET_LENGTH)
      problem("RESEND_WEBHOOK_SECRET", `must be at least ${MIN_SECRET_LENGTH} characters after whsec_`);
  }

  // The database: the app connects through Neon's pooler, as the app role.
  if (has("DATABASE_URL")) {
    const url = parseUrl(value(env, "DATABASE_URL"));
    if (!url || !/^postgres(ql)?:$/.test(url.protocol)) problem("DATABASE_URL", "is not a postgres URL");
    else {
      if (!url.hostname.split(".")[0]?.endsWith("-pooler"))
        problem("DATABASE_URL", "must use the pooled (-pooler) host");
      const user = decodeURIComponent(url.username);
      const migrations = parseUrl(value(env, "MIGRATIONS_DATABASE_URL"));
      const migrationsUser = migrations && decodeURIComponent(migrations.username);
      if (user === MIGRATIONS_ROLE || (migrationsUser && user === migrationsUser))
        problem("DATABASE_URL", "must not be the migrations role");
    }
  }

  // The seed's accounts on a public staging need a secret password.
  if (target === "staging" && has("SEED_USER_PASSWORD")) {
    if (value(env, "SEED_USER_PASSWORD") === DEV_SEED_PASSWORD)
      problem("SEED_USER_PASSWORD", "is the dev default");
    else if (value(env, "SEED_USER_PASSWORD").length < 16)
      problem("SEED_USER_PASSWORD", "must be at least 16 characters");
  }

  return problems;
}

/** The problems as lines: `NAME problem`. Names only, never values. */
export const formatDeployEnvProblems = (problems: readonly DeployEnvProblem[]) =>
  problems.map((p) => `${p.variable} ${p.problem}`);

/**
 * The server's own check: nothing when `APP_ENV` is unset (dev, tests, check
 * builds), else `checkDeployEnv` for it (an unknown `APP_ENV` is a problem).
 */
export function serverDeployEnvProblems(env: Env): DeployEnvProblem[] {
  const appEnv = value(env, "APP_ENV");
  if (!appEnv) return [];
  if (!isDeployTarget(appEnv)) return [{ variable: "APP_ENV", problem: 'must be "staging" or "production"' }];
  return checkDeployEnv(appEnv, env, { scope: "server" });
}

let checked: DeployEnvProblem[] | undefined;

/**
 * A page React Router prerenders at build (marketing pages, robots.txt,
 * sitemap.xml). The build doesn't hold the deploy's secrets (`vercel pull`
 * leaves sensitive values empty), and its pages need none, so it isn't
 * refused. React Router's own test: its build sets `IS_RR_BUILD_REQUEST=yes`
 * in its process and the header on each request; a deployed server never has
 * the env var, so the header alone changes nothing.
 */
export const isPrerenderRequest = (request: Request, env: Env = process.env) =>
  env.IS_RR_BUILD_REQUEST === "yes" && request.headers.get("X-React-Router-Prerender") === "yes";

/**
 * Every request starts here (documents, `.data` and web-only resource
 * routes): a 503 while the environment is wrong, else null. Checked once per
 * server (lazily, on the first request, as config is read), and the names
 * logged once; Vercel's env changes only with a new deploy.
 */
export function deployEnvRefusal(
  request: Request,
  env: Env = process.env,
  log: (line: string) => void = (line) => console.error(line),
): Response | null {
  if (isPrerenderRequest(request, env)) return null;
  if (!checked) {
    checked = serverDeployEnvProblems(env);
    if (checked.length) {
      const names = [...new Set(checked.map((p) => p.variable))].join(", ");
      log(`deploy env: refusing to serve until these are fixed: ${names}`);
    }
  }
  if (!checked.length) return null;
  return new Response("Service unavailable: this deploy's configuration is incomplete.", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "60" },
  });
}

/** Tests only: forget the cached answer. */
export const resetDeployEnvCheck = () => {
  checked = undefined;
};
