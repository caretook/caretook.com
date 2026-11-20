// The browser security headers (quick-fixes slice 22, B-81; security review
// S-5), built in one place for every web response:
//
//   - documents (entry.server.tsx `handleRequest`): the whole set, with a
//     per-request nonce for React Router's and React's inline scripts;
//   - `.data` requests (`handleDataRequest`) and web-only resource routes
//     (`/rpc`, `/api/auth`, sitemap, exports…: the `web` layout route's
//     middleware): the same set, with the document policy (harmless on JSON);
//   - files the host serves itself (prerendered marketing pages, assets,
//     public/): `HOST_HEADERS`, mirrored in apps/web/vercel.json (a unit test
//     keeps them equal), plus the page's own `<meta>` policy;
//   - the native SPA (Capacitor): its index.html carries the `<meta>` policy.
//
// Server only (node:crypto). The policy itself is pure: `contentSecurityPolicy`.
import { createHash, randomBytes } from "node:crypto";

import { BUILD_APP_ENV, isNoindex, X_ROBOTS_TAG } from "../lib/marketing/noindex";
import { THEME_SCRIPT } from "../lib/app-shell/theme";

export type CspOptions = {
  /** This response's nonce (base64), for the inline scripts React Router and React render. */
  nonce?: string;
  /** Where the browser syncs from: `VITE_POWERSYNC_URL` (else `POWERSYNC_URL`). */
  powerSyncUrl?: string;
  /** The API's origin when it isn't this one (`VITE_API_ORIGIN`; the native app). */
  apiOrigin?: string;
  /** The Vite dev server: its HMR websocket. */
  dev?: boolean;
  /** For a `<meta>` element: drops `frame-ancestors`, which browsers ignore (and complain about) there. */
  meta?: boolean;
};

/** `'sha256-…'` of an inline script's exact text. */
export const scriptHash = (source: string) =>
  `'sha256-${createHash("sha256").update(source, "utf8").digest("base64")}'`;

/** The theme script's hash, from the constant itself (never copied by hand). */
export const THEME_SCRIPT_HASH = scriptHash(THEME_SCRIPT);

/** 128 random bits, base64: a new one per document. */
export const newNonce = () => randomBytes(16).toString("base64");

/** A URL's origin, or nothing for an empty or unparsable value. */
const originOf = (url: string | undefined) => {
  if (!url?.trim()) return undefined;
  try {
    return new URL(url.trim()).origin;
  } catch {
    return undefined;
  }
};

export function contentSecurityPolicy(options: CspOptions = {}): string {
  const connect = ["'self'"];
  for (const origin of [originOf(options.powerSyncUrl), originOf(options.apiOrigin)]) {
    if (origin && !connect.includes(origin)) connect.push(origin);
  }
  // Vite's HMR socket (dev only; 'self' doesn't match ws: in every browser).
  if (options.dev) connect.push("ws://localhost:*", "ws://127.0.0.1:*");

  const directives: [string, ...string[]][] = [
    ["default-src", "'self'"],
    [
      "script-src",
      "'self'",
      THEME_SCRIPT_HASH,
      ...(options.nonce ? [`'nonce-${options.nonce}'`] : []),
      // PowerSync's SQLite is WebAssembly: compiling it needs this (not 'unsafe-eval').
      "'wasm-unsafe-eval'",
    ],
    // Inline styles: React Aria and Tiptap set style attributes in rendered
    // HTML and insert <style> elements, and Vite injects CSS as <style> in dev.
    ["style-src", "'self'", "'unsafe-inline'"],
    ["img-src", "'self'", "data:", "blob:"],
    ["font-src", "'self'", "data:"],
    ["connect-src", ...connect],
    // PowerSync's shared and dedicated workers (same-origin modules; blob: for its fallbacks).
    ["worker-src", "'self'", "blob:"],
    ["object-src", "'none'"],
    ["base-uri", "'self'"],
    ["form-action", "'self'"],
    ...(options.meta ? [] : [["frame-ancestors", "'none'"] as [string, string]]),
  ];
  return directives.map((d) => d.join(" ")).join("; ");
}

/** Off for the features we never use; Web Share and the clipboard keep their default (this origin). */
export const PERMISSIONS_POLICY = "camera=(), microphone=(), geolocation=(), payment=()";

export const HSTS = "max-age=63072000; includeSubDomains";

/**
 * The headers that don't depend on the response: what the host adds to every
 * file it serves itself (apps/web/vercel.json, and the check build's server).
 * The CSP here is only what a `<meta>` policy can't carry (framing), plus the
 * safe directives; a prerendered page's own `<meta>` policy governs its scripts.
 */
export const HOST_HEADERS = {
  "Content-Security-Policy": "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  "Strict-Transport-Security": HSTS,
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "Permissions-Policy": PERMISSIONS_POLICY,
} as const satisfies Record<string, string>;

export type HeaderOptions = CspOptions & {
  /** HTTPS only: production (a check build too; browsers ignore it over http). */
  hsts?: boolean;
  /** Staging: `X-Robots-Tag: noindex` on every response (hosting slice 1). */
  noindex?: boolean;
};

/** The full set for a response the app makes. */
export function securityHeaders(options: HeaderOptions = {}): Record<string, string> {
  const { hsts, noindex, ...csp } = options;
  return {
    "Content-Security-Policy": contentSecurityPolicy({ ...csp, meta: false }),
    ...(hsts && { "Strict-Transport-Security": HSTS }),
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "Permissions-Policy": PERMISSIONS_POLICY,
    ...(noindex && { "X-Robots-Tag": X_ROBOTS_TAG }),
  };
}

/** Options from this server's environment (and what Vite baked in). */
export const envOptions = (env: NodeJS.ProcessEnv = process.env): HeaderOptions => ({
  powerSyncUrl: (import.meta.env.VITE_POWERSYNC_URL as string | undefined) || env.POWERSYNC_URL,
  apiOrigin: import.meta.env.VITE_API_ORIGIN,
  dev: import.meta.env.DEV,
  hsts: env.NODE_ENV === "production",
  // Staging, at run time or as built (they agree: each environment builds itself).
  noindex: isNoindex(env.APP_ENV) || isNoindex(BUILD_APP_ENV),
});

/**
 * Adds the set to a response's headers, keeping any a route already set (a
 * document's nonce policy passes through the `web` middleware unchanged).
 */
export function applySecurityHeaders(headers: Headers, options: HeaderOptions = envOptions()) {
  for (const [name, value] of Object.entries(securityHeaders(options))) {
    if (!headers.has(name)) headers.set(name, value);
  }
}
