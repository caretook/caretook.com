// The post-deploy smoke check (hosting slice 5): is the deploy at `appUrl`,
// with its PowerSync instance at `powersyncUrl`, actually serving? Pure apart
// from the injected `fetch`, so it's unit-tested against a stub;
// `pnpm deploy:smoke <target>` (smoke.mjs) runs it as the deploy Action's
// last step.
//
// Every check runs at once, each with its own timeout (a timeout fails that
// check, by name). A result's detail says what was wrong in public terms
// (statuses and header names), never a body, a token or a secret.

/** Each check's time limit. */
export const SMOKE_TIMEOUT_MS = 15_000;

/** A session-less call to a procedure that needs a session. */
export const UNAUTHENTICATED_PROCEDURE = "/rpc/me/get";

/**
 * PowerSync's health endpoint: the service's liveness probe. Confirmed on
 * the self-hosted service; PowerSync Cloud serves the same routes (checked
 * at slice 7 against the real instance).
 */
export const POWERSYNC_HEALTH_PATH = "/probes/liveness";

/** The headers the home page must carry (docs/domain/security-headers.md). */
export const SECURITY_HEADERS = ["strict-transport-security", "content-security-policy", "x-frame-options"];

/** The check names, in the order they're reported. */
export const SMOKE_CHECKS = [
  "home",
  "jwks",
  "rpc-unauthenticated",
  "cron-locked",
  "mcp-unauthenticated",
  "powersync",
  "noindex",
];

const join = (base, path) => `${base.replace(/\/+$/, "")}${path}`;

/** `run(signal)`, failed with a timeout error after `ms` even if it ignores the signal. */
const withTimeout = async (run, ms) => {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`timed out after ${ms} ms`));
    }, ms);
  });
  try {
    return await Promise.race([run(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
};

const fail = (detail) => ({ ok: false, detail });
const pass = (detail) => ({ ok: true, detail });

/**
 * Run the smoke checks. `staging` adds `noindex` (staging must never be
 * indexed). Resolves to one `{ name, ok, detail }` per check, in
 * SMOKE_CHECKS order; it never rejects.
 */
export async function smoke({ appUrl, powersyncUrl, fetch, staging = false, timeoutMs = SMOKE_TIMEOUT_MS }) {
  const get = (url, init, signal) => fetch(url, { redirect: "manual", ...init, signal });

  /** @type {Record<string, (signal: AbortSignal) => Promise<{ ok: boolean, detail: string }>>} */
  const checks = {
    home: async (signal) => {
      const res = await get(join(appUrl, "/"), {}, signal);
      if (res.status !== 200) return fail(`status ${res.status}, expected 200`);
      const missing = SECURITY_HEADERS.filter((h) => !res.headers.get(h));
      if (missing.length) return fail(`missing ${missing.join(", ")}`);
      return pass("200 with HSTS, CSP and X-Frame-Options");
    },
    jwks: async (signal) => {
      const res = await get(join(appUrl, "/api/auth/jwks"), {}, signal);
      if (res.status !== 200) return fail(`status ${res.status}, expected 200`);
      let body;
      try {
        body = await res.json();
      } catch {
        return fail("not JSON");
      }
      const keys = Array.isArray(body?.keys) ? body.keys.length : 0;
      if (!keys) return fail("no keys");
      return pass(`${keys} key${keys === 1 ? "" : "s"}`);
    },
    "rpc-unauthenticated": async (signal) => {
      const res = await get(
        join(appUrl, UNAUTHENTICATED_PROCEDURE),
        {
          method: "POST",
          // The CSRF header every oRPC call carries, so the refusal is the session's.
          headers: { "content-type": "application/json", "x-csrf-token": "orpc" },
          body: JSON.stringify({ json: {} }),
        },
        signal,
      );
      if (res.status !== 401) return fail(`status ${res.status}, expected 401`);
      const text = await res.text().catch(() => "");
      if (!text.includes('"UNAUTHORIZED"')) return fail("401 without the UNAUTHORIZED error");
      return pass("401 UNAUTHORIZED");
    },
    "cron-locked": async (signal) => {
      const res = await get(join(appUrl, "/api/cron/outbox"), {}, signal);
      if (res.status !== 401) return fail(`status ${res.status}, expected 401`);
      return pass("401 without a bearer");
    },
    // The connectors' MCP endpoint refuses a call without a token and points
    // the client at its OAuth metadata (docs/domain/connectors.md).
    "mcp-unauthenticated": async (signal) => {
      const res = await get(
        join(appUrl, "/mcp"),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
        },
        signal,
      );
      if (res.status !== 401) return fail(`status ${res.status}, expected 401`);
      if (!/resource_metadata=/.test(res.headers.get("www-authenticate") ?? ""))
        return fail("401 without WWW-Authenticate resource_metadata");
      return pass("401 with resource_metadata");
    },
    powersync: async (signal) => {
      const res = await get(join(powersyncUrl, POWERSYNC_HEALTH_PATH), {}, signal);
      if (!res.ok) return fail(`status ${res.status}, expected 2xx`);
      return pass(`status ${res.status}`);
    },
  };
  if (staging)
    checks.noindex = async (signal) => {
      const res = await get(join(appUrl, "/"), {}, signal);
      const robots = res.headers.get("x-robots-tag") ?? "";
      if (!/noindex/i.test(robots)) return fail("no X-Robots-Tag: noindex");
      return pass("X-Robots-Tag: noindex");
    };

  const names = SMOKE_CHECKS.filter((name) => name in checks);
  return Promise.all(
    names.map(async (name) => {
      try {
        return { name, ...(await withTimeout(checks[name], timeoutMs)) };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { name, ok: false, detail: message };
      }
    }),
  );
}

/** The results as a table, one line each: `✓ name  detail`. */
export const formatSmokeTable = (results) => {
  const width = Math.max(...results.map((r) => r.name.length));
  return results.map((r) => `${r.ok ? "✓" : "✗"} ${r.name.padEnd(width)}  ${r.detail}`);
};
