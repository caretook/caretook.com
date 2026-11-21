import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { THEME_SCRIPT } from "../lib/app-shell/theme";
import {
  HOST_HEADERS,
  THEME_SCRIPT_HASH,
  applySecurityHeaders,
  contentSecurityPolicy,
  envOptions,
  newNonce,
  securityHeaders,
} from "./securityHeaders";

const directives = (policy: string): Record<string, string[] | undefined> =>
  Object.fromEntries(
    policy.split("; ").map((d) => {
      const [name = "", ...values] = d.split(" ");
      return [name, values] as const;
    }),
  );

describe("contentSecurityPolicy", () => {
  const policy = directives(
    contentSecurityPolicy({ nonce: "abc", powerSyncUrl: "https://sync.example.com/path" }),
  );

  it("has every directive", () => {
    expect(policy).toEqual({
      "default-src": ["'self'"],
      "script-src": ["'self'", THEME_SCRIPT_HASH, "'nonce-abc'", "'wasm-unsafe-eval'"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "img-src": ["'self'", "data:", "blob:"],
      "font-src": ["'self'", "data:"],
      "connect-src": ["'self'", "https://sync.example.com"],
      "worker-src": ["'self'", "blob:"],
      "object-src": ["'none'"],
      "base-uri": ["'self'"],
      "form-action": ["'self'"],
      "frame-ancestors": ["'none'"],
    });
  });

  it("allows the theme script by the hash of the constant itself", () => {
    const hash = createHash("sha256").update(THEME_SCRIPT).digest("base64");
    expect(THEME_SCRIPT_HASH).toBe(`'sha256-${hash}'`);
  });

  it("adds the API origin, once, and ignores empty or broken URLs", () => {
    const connect = (o: Parameters<typeof contentSecurityPolicy>[0]) =>
      directives(contentSecurityPolicy(o))["connect-src"];
    expect(connect({ apiOrigin: "https://caretook.com", powerSyncUrl: "https://caretook.com" })).toEqual([
      "'self'",
      "https://caretook.com",
    ]);
    expect(connect({ apiOrigin: "", powerSyncUrl: "not a url" })).toEqual(["'self'"]);
  });

  it("has no nonce without one, and the HMR socket only in dev", () => {
    const plain = directives(contentSecurityPolicy());
    expect(plain["script-src"]).not.toContainEqual(expect.stringMatching(/nonce/));
    expect(plain["connect-src"]).toEqual(["'self'"]);
    expect(directives(contentSecurityPolicy({ dev: true }))["connect-src"]).toContain("ws://localhost:*");
  });

  it("leaves frame-ancestors out of a <meta> policy", () => {
    expect(directives(contentSecurityPolicy({ meta: true }))["frame-ancestors"]).toBeUndefined();
  });
});

describe("securityHeaders", () => {
  it("sends HSTS only when asked (production)", () => {
    expect(securityHeaders({ hsts: true })["Strict-Transport-Security"]).toBe(
      "max-age=63072000; includeSubDomains",
    );
    expect(securityHeaders()).not.toHaveProperty("Strict-Transport-Security");
  });

  it("sets the fixed headers", () => {
    expect(securityHeaders()).toMatchObject({
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    });
  });

  it("asks search engines to stay away on staging only (hosting slice 1)", () => {
    expect(securityHeaders({ noindex: true })["X-Robots-Tag"]).toBe("noindex");
    expect(securityHeaders()).not.toHaveProperty("X-Robots-Tag");
    expect(envOptions({ APP_ENV: "staging" }).noindex).toBe(true);
    expect(envOptions({ APP_ENV: "production" }).noindex).toBe(false);
    expect(envOptions({}).noindex).toBe(false);
  });

  it("keeps headers a response already has", () => {
    const headers = new Headers({ "Content-Security-Policy": "default-src 'none'" });
    applySecurityHeaders(headers, {});
    expect(headers.get("Content-Security-Policy")).toBe("default-src 'none'");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("makes a fresh nonce each time", () => {
    expect(newNonce()).not.toBe(newNonce());
    expect(Buffer.from(newNonce(), "base64")).toHaveLength(16);
  });
});

describe("HOST_HEADERS", () => {
  it("is what apps/web/vercel.json sends for every path", () => {
    const config = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8")) as {
      headers: {
        source: string;
        has?: { type: string; value: string }[];
        headers: { key: string; value: string }[];
      }[];
    };
    const all = config.headers.find((h) => h.source === "/(.*)" && !h.has)!;
    expect(Object.fromEntries(all.headers.map((h) => [h.key, h.value]))).toEqual(HOST_HEADERS);
  });

  it("adds X-Robots-Tag on the staging host only (hosting slice 1)", () => {
    const config = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8")) as {
      headers: {
        source: string;
        has?: { type: string; value: string }[];
        headers: { key: string; value: string }[];
      }[];
      regions: string[];
      crons: { path: string; schedule: string }[];
    };
    const conditional = config.headers.filter((h) => h.has);
    expect(conditional).toEqual([
      {
        source: "/(.*)",
        has: [{ type: "host", value: "staging.caretook.com" }],
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      },
    ]);
    // The functions sit beside Neon (aws-us-east-2), and the outbox sweeps every minute.
    expect(config.regions).toEqual(["cle1"]);
    expect(config.crons).toEqual([
      { path: "/api/cron/outbox", schedule: "* * * * *" },
      { path: "/api/cron/calendar", schedule: "* * * * *" },
    ]);
  });

  it("matches the app's own headers apart from the CSP", () => {
    const { "Content-Security-Policy": hostCsp, ...host } = HOST_HEADERS;
    const { "Content-Security-Policy": appCsp, ...app } = securityHeaders({ hsts: true });
    expect(host).toEqual(app);
    for (const directive of hostCsp.split("; ")) expect(appCsp).toContain(directive);
  });
});
