// The smoke check (hosting slice 5) against a stub fetch: a healthy deploy
// passes, each check fails by name, a timeout is a failure, and noindex is
// staging's only.
import { describe, expect, it } from "vitest";

import { formatSmokeTable, POWERSYNC_HEALTH_PATH, smoke, SMOKE_CHECKS } from "./smoke-checks.mjs";

const APP = "https://staging.caretook.com";
const POWERSYNC = "https://fictional.powersync.journeyapps.com";

const SECURE = {
  "strict-transport-security": "max-age=63072000; includeSubDomains",
  "content-security-policy": "frame-ancestors 'none'",
  "x-frame-options": "DENY",
};

/** A healthy deploy's answers, by URL; `overrides` replaces one. */
const healthy = {
  [`${APP}/`]: () => new Response("<html></html>", { headers: { ...SECURE, "x-robots-tag": "noindex" } }),
  [`${APP}/api/auth/jwks`]: () => Response.json({ keys: [{ kid: "k1", kty: "OKP" }] }),
  [`${APP}/rpc/me/get`]: () =>
    Response.json({ json: { defined: false, code: "UNAUTHORIZED", status: 401 } }, { status: 401 }),
  [`${APP}/api/cron/outbox`]: () => new Response("Unauthorized", { status: 401 }),
  [`${POWERSYNC}${POWERSYNC_HEALTH_PATH}`]: () => Response.json({ ready: true }),
};

const stubFetch =
  (overrides = {}) =>
  async (url, init) => {
    const answer = { ...healthy, ...overrides }[url];
    if (!answer) return new Response("not found", { status: 404 });
    return answer(init);
  };

const run = (overrides, options = {}) =>
  smoke({ appUrl: APP, powersyncUrl: POWERSYNC, fetch: stubFetch(overrides), staging: true, ...options });

const failures = (results) => results.filter((r) => !r.ok).map((r) => r.name);

describe("smoke", () => {
  it("passes a healthy deploy, every check by name", async () => {
    const results = await run();
    expect(results.map((r) => r.name)).toEqual(SMOKE_CHECKS);
    expect(failures(results)).toEqual([]);
  });

  it("sends the unauthenticated call as an oRPC call with the CSRF header and no session", async () => {
    let seen;
    await run({
      [`${APP}/rpc/me/get`]: (init) => {
        seen = init;
        return healthy[`${APP}/rpc/me/get`]();
      },
    });
    expect(seen.method).toBe("POST");
    expect(seen.headers["x-csrf-token"]).toBe("orpc");
    expect(seen.headers.cookie).toBeUndefined();
    expect(seen.headers.authorization).toBeUndefined();
  });

  it.each([
    [
      "home",
      `${APP}/`,
      () => new Response("down", { status: 500, headers: { ...SECURE, "x-robots-tag": "noindex" } }),
    ],
    [
      "home",
      `${APP}/`,
      () => new Response("ok", { headers: { "x-frame-options": "DENY", "x-robots-tag": "noindex" } }),
    ],
    ["jwks", `${APP}/api/auth/jwks`, () => Response.json({ keys: [] })],
    ["jwks", `${APP}/api/auth/jwks`, () => new Response("<html>", { status: 200 })],
    ["rpc-unauthenticated", `${APP}/rpc/me/get`, () => Response.json({ json: { ok: true } })],
    [
      "rpc-unauthenticated",
      `${APP}/rpc/me/get`,
      () => Response.json({ json: { code: "FORBIDDEN" } }, { status: 401 }),
    ],
    ["cron-locked", `${APP}/api/cron/outbox`, () => Response.json({ delivered: 0 })],
    // CRON_SECRET unset: the route answers 503, which isn't locked.
    ["cron-locked", `${APP}/api/cron/outbox`, () => new Response("", { status: 503 })],
    ["powersync", `${POWERSYNC}${POWERSYNC_HEALTH_PATH}`, () => new Response("", { status: 503 })],
  ])("fails %s alone when it's wrong", async (name, url, answer) => {
    const results = await run({ [url]: answer });
    expect(failures(results)).toEqual([name]);
  });

  it("names the missing security headers", async () => {
    const results = await run({
      [`${APP}/`]: () => new Response("ok", { headers: { "x-robots-tag": "noindex" } }),
    });
    expect(results.find((r) => r.name === "home")?.detail).toMatch(
      /strict-transport-security.*content-security-policy.*x-frame-options/,
    );
  });

  it("counts a network error as that check's failure", async () => {
    const results = await run({
      [`${APP}/api/auth/jwks`]: () => Promise.reject(new TypeError("fetch failed")),
    });
    expect(failures(results)).toEqual(["jwks"]);
    expect(results.find((r) => r.name === "jwks")?.detail).toBe("fetch failed");
  });

  it("counts a timeout as a failure, even when fetch ignores the abort", async () => {
    const results = await run(
      { [`${POWERSYNC}${POWERSYNC_HEALTH_PATH}`]: () => new Promise(() => {}) },
      { timeoutMs: 50 },
    );
    expect(failures(results)).toEqual(["powersync"]);
    expect(results.find((r) => r.name === "powersync")?.detail).toMatch(/timed out/);
  });

  it("aborts a timed-out request", async () => {
    let signal;
    await run(
      {
        [`${APP}/api/cron/outbox`]: (init) => {
          signal = init.signal;
          return new Promise(() => {});
        },
      },
      { timeoutMs: 50 },
    );
    expect(signal.aborted).toBe(true);
  });

  it("checks noindex on staging only", async () => {
    const indexed = { [`${APP}/`]: () => new Response("ok", { headers: SECURE }) };
    expect(failures(await run(indexed))).toEqual(["noindex"]);

    const production = await run(indexed, { staging: false });
    expect(production.map((r) => r.name)).not.toContain("noindex");
    expect(failures(production)).toEqual([]);
  });

  it("formats a table with a mark per check", async () => {
    const lines = formatSmokeTable(await run({ [`${APP}/api/cron/outbox`]: () => new Response("") }));
    expect(lines).toHaveLength(SMOKE_CHECKS.length);
    expect(lines.find((l) => l.includes("cron-locked"))).toMatch(/^✗ cron-locked/);
    expect(lines.find((l) => l.includes("jwks"))).toMatch(/^✓ jwks/);
  });
});
