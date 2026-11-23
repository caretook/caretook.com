// The Playwright Test harness for the browser checks (`*.spec.mjs`). Specs import `test` and `expect` from here, never
// from @playwright/test, so every page gets the same setup:
//
// - `device(label, opts)`: a new browser context, one per device, each with its
//   own client IP (`x-forwarded-for`): a check build runs with NODE_ENV=production,
//   so Better Auth's rate limits (about 3 sign-ins per 10 s per IP) are on, and
//   every device has its own bucket, as real users do. Call it twice for two
//   devices. A 420×900 window in America/Los_Angeles and en-US by default.
// - Every page's console errors and warnings, uncaught errors and failed loads
//   are collected (`d.errors`, `d.uncaught`), except PowerSync's teardown
//   warning (`[PowerSync]: Sync aborted`, the shared sync worker's log for a
//   page that closed, broadcast to the next one). A Content-Security-Policy
//   violation fails the test, whatever the spec asserts.
// - Offline: `device(label, { offlineable: true })` sends the device's traffic
//   through its own switchable proxy (below), and `d.offline(true)` cuts it,
//   page and workers alike, the way losing Wi-Fi would. Playwright's
//   `context.setOffline` is not enough: it leaves PowerSync's sync stream (in
//   its shared worker) connected, as CDP's network emulation did (measured:
//   still connected 80 s later). `navigator.onLine` stays true; call `d.context.setOffline` as well for a test that needs it false.
// - `signIn`, `openDevFamily` and `signOut` `waitFor`
//   (polls an in-page function and awaits what it returns, so a promise counts
//   by what it resolves to: B-172), and `psql` against the worktree's `PG_CONTAINER`.
// - Smoke mode (`SMOKE=1`, `pnpm prd browser --smoke`): a test without the
//   `@smoke` tag is skipped ("SKIP <title> (smoke)").
//
// Run specs only through `pnpm prd browser <check>` (browser.sh): it holds the
// lease, runs Playwright Test with one worker and this directory's config, and
// applies the limits and the retry.
import { execFileSync } from "node:child_process";
import http from "node:http";
import net from "node:net";
import { test as base, expect } from "@playwright/test";

import { testZone } from "../ci/zones.mjs";

export { expect };

export const BASE = process.env.BASE ?? "http://localhost:5176";
export const PASSWORD = process.env.SEED_USER_PASSWORD ?? "caretook-dev-password";
export const PG_CONTAINER = process.env.PG_CONTAINER ?? "caretook-postgres-1";
export const SMOKE = process.env.SMOKE === "1";
/** Dev Family, the seeded group every check works in (member@ is also in another). */
export const DEV_FAMILY = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";
export const DEV_FAMILY_TIMELINE = `/app/groups/${DEV_FAMILY}/timeline`;

/** PowerSync's teardown log for a page that closed, broadcast to the next page: never a failure. */
export const POWERSYNC_TEARDOWN = /\[PowerSync\]: Sync aborted/;

const octet = () => Math.floor(Math.random() * 254) + 1;
/** A fresh client IP for one device. */
export const randomIp = () => `10.${octet()}.${octet()}.${octet()}`;

/** Runs `sql` in the worktree's Postgres container and returns its trimmed output. */
export function psql(sql) {
  return execFileSync("docker", [
    "exec",
    "-i",
    PG_CONTAINER,
    "psql",
    "-U",
    "caretook",
    "-d",
    "caretook",
    "-tAq",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    sql,
  ])
    .toString()
    .trim();
}

/**
 * Polls `fn` in the page (with `arg`) until it returns something truthy,
 * awaiting what it returns: a promise counts by what it resolves to (B-172).
 * A navigation or a throw mid-poll counts as not yet. Fails after `timeout` ms
 * with `message` (else the function's source).
 */
export async function waitFor(page, fn, { arg, timeout = 10_000, message } = {}) {
  await expect
    .poll(
      async () => {
        try {
          return !!(await page.evaluate(fn, arg));
        } catch {
          return false;
        }
      },
      { timeout, message: message ?? `waiting for ${String(fn).slice(0, 200)}`, intervals: [100] },
    )
    .toBe(true);
}

/**
 * On the `/app` group list (member@ is in two seeded groups), open Dev
 * Family's timeline. A user with one group is already on its timeline; one
 * with none stays on the list.
 */
export async function openDevFamily(page, { timeout = 45_000 } = {}) {
  await waitFor(
    page,
    () =>
      location.pathname !== "/app" || document.querySelector("main h1")?.textContent === "Your care groups",
    { timeout },
  );
  if (new URL(page.url()).pathname !== "/app") return;
  const link = page.locator('main a[href$="/timeline"]', { hasText: "Grandma Pat" });
  if (!(await link.count())) return;
  await link.click();
  await page.waitForURL(/\/timeline$/, { timeout });
}

/**
 * Sign in through the form; then, unless `home`, go on from the group list to
 * Dev Family. A 401 from the sync token endpoint leaves the device local-only
 * (no first sync), so it retries once, with a log line.
 */
export async function signIn(page, email, password = PASSWORD, { home = false } = {}) {
  let tokenRefused = false;
  const watch = (response) => {
    if (response.status() === 401 && new URL(response.url()).pathname === "/api/auth/token")
      tokenRefused = true;
  };
  page.on("response", watch);
  const submit = async () => {
    await page.goto("/sign-in");
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.locator('form button[type="submit"]').click();
    // The first /app load (PowerSync, cold modules) can be slow on a busy machine.
    await page.waitForURL((url) => url.pathname.startsWith("/app"), { timeout: 45_000 });
  };
  try {
    await submit();
    if (tokenRefused) {
      console.log(`/api/auth/token answered 401 after signing in as ${email}; retrying once`);
      tokenRefused = false;
      // Reload once the token endpoint answers this session (not after a fixed pause).
      await expect
        .poll(
          () =>
            page.evaluate(() => fetch("/api/auth/token", { credentials: "include" }).then((r) => r.status)),
          {
            timeout: 10_000,
            message: "/api/auth/token answers the new session",
          },
        )
        .toBe(200)
        .catch(() => console.log(`/api/auth/token still refuses ${email}; reloading anyway`));
      await page.reload();
      if (new URL(page.url()).pathname === "/sign-in") await submit();
      else await page.waitForURL((url) => url.pathname.startsWith("/app"), { timeout: 45_000 });
      if (tokenRefused) console.log(`/api/auth/token answered 401 again`);
    }
  } finally {
    page.off("response", watch);
  }
  if (!home) await openDevFamily(page);
}

/** Sign out through the header's account menu. */
export async function signOut(page) {
  await page.locator('header [data-region="user"] button[aria-label^="Account menu for"]').click();
  await page.getByRole("menuitem", { name: "Sign out", exact: true }).click();
}

/**
 * Today's + button on the timeline (writers only), which opens the add menu.
 */
export const addButton = (page) => page.locator('main [data-day-header] button[aria-label="Add to Today"]');

/**
 * Add to the timeline through Today's + menu: open it, then choose `item`
 * ("Note", "Symptom"…); a vital type ("Temperature") with `{ group: "Vitals" }`,
 * which expands that group first.
 */
export async function addToTimeline(page, item, { group } = {}) {
  const menuItem = (text) =>
    page.locator('[role="menu"] [role="menuitem"]', { hasText: new RegExp(`^${text}$`) });
  const choice = menuItem(group ?? item);
  await addButton(page).click();
  // A tap that lands while a menu is still closing doesn't open it: once more.
  if (
    !(await choice.waitFor({ timeout: 3000 }).then(
      () => true,
      () => false,
    ))
  ) {
    await addButton(page).click();
  }
  await choice.click();
  if (group) await menuItem(item).click();
}

/**
 * Resolves once the page has no app asset or rpc request in flight for `quietMs`:
 * the build prefetches route chunks after a load, and cutting the network
 * mid-prefetch makes React Router reload the page (into the browser's error page).
 */
export async function assetsSettled(page, quietMs = 1000) {
  let inflight = 0;
  let lastActivity = Date.now();
  const relevant = (r) => /\/(assets|rpc)\//.test(new URL(r.url()).pathname);
  const start = (r) => relevant(r) && (inflight++, (lastActivity = Date.now()));
  const end = (r) => relevant(r) && (inflight--, (lastActivity = Date.now()));
  page.on("request", start);
  page.on("requestfinished", end);
  page.on("requestfailed", end);
  try {
    await expect
      .poll(() => inflight <= 0 && Date.now() - lastActivity >= quietMs, { timeout: 30_000 })
      .toBe(true);
  } finally {
    page.off("request", start);
    page.off("requestfinished", end);
    page.off("requestfailed", end);
  }
}

/**
 * A forward proxy that can be switched off, on a free port (for specs). Chrome sends WebSockets through a proxy as CONNECT tunnels, so it
 * tunnels CONNECT too. Vite's own sockets (protocols `vite-hmr`, `vite-ping`;
 * `--dev` only) are dev tooling, not the app's network: going offline leaves
 * them open, so Vite doesn't reload the page when they reconnect.
 * Resolves to { server, setOnline(on), close() }.
 */
export async function startProxy() {
  let online = true;
  // `hold(port)`: requests and tunnels to that port wait until `release()`.
  let gate = null;
  const gated = async (port) => {
    if (gate && String(port) === gate.port) await gate.open;
  };
  const sockets = new Set();
  const track = (s) => {
    sockets.add(s);
    s.on("close", () => sockets.delete(s));
  };
  const server = http.createServer(async (req, res) => {
    if (!online) return req.socket.destroy();
    const url = new URL(req.url);
    await gated(url.port);
    const upstream = http.request(
      {
        host: url.hostname,
        port: url.port || 80,
        path: url.pathname + url.search,
        method: req.method,
        headers: req.headers,
      },
      (up) => {
        res.writeHead(up.statusCode, up.headers);
        up.pipe(res);
      },
    );
    upstream.on("error", () => res.destroy());
    req.pipe(upstream);
  });
  server.on("connection", (s) => (online ? track(s) : s.destroy()));
  server.on("connect", async (req, socket, head) => {
    if (!online) return socket.destroy();
    const [host, port] = req.url.split(":");
    await gated(port);
    const up = net.connect(Number(port) || 443, host, () => {
      socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length) up.write(head);
      socket.pipe(up).pipe(socket);
    });
    track(up);
    // A tunnel is Vite's when its first request asks for a vite- protocol.
    socket.once("data", (chunk) => {
      if (/^sec-websocket-protocol:\s*vite-/im.test(chunk.toString("latin1"))) {
        sockets.delete(socket);
        sockets.delete(up);
      }
    });
    up.on("error", () => socket.destroy());
    socket.on("error", () => up.destroy());
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    server: `http://127.0.0.1:${server.address().port}`,
    setOnline(on) {
      online = on;
      if (!on) for (const s of sockets) s.destroy();
    },
    /** Hold new traffic to `port` (PowerSync's, say) until `release()`; a held request waits, it isn't refused. */
    hold(port) {
      let open;
      gate = { port: String(port), open: new Promise((r) => (open = r)), release: open };
    },
    release() {
      gate?.release();
      gate = null;
    },
    close: () => {
      gate?.release();
      for (const s of sockets) s.destroy();
      server.close();
    },
  };
}

/**
 * Whether the device's IndexedDB copy of the local database (caretook.sqlite)
 * still holds `text` in its bytes: "holds it", "clean", "no file" or
 * "open hung". Sign-out deletes or vacuums the file, so "clean" is what a
 * wipe leaves.
 */
export const localCopyHolds = (page, text) =>
  page.evaluate(async (needle) => {
    if (!(await indexedDB.databases()).some((d) => d.name === "caretook.sqlite")) return "no file";
    const db = await Promise.race([
      new Promise((res, rej) => {
        const r = indexedDB.open("caretook.sqlite");
        r.onsuccess = () => res(r.result);
        r.onerror = rej;
      }),
      new Promise((res) => setTimeout(() => res(null), 3000)),
    ]);
    if (!db) return "open hung";
    const dec = new TextDecoder("latin1");
    let hits = 0;
    const visit = (v) => {
      if (v instanceof ArrayBuffer || ArrayBuffer.isView(v)) {
        const u =
          v instanceof ArrayBuffer ? new Uint8Array(v) : new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
        if (dec.decode(u).includes(needle)) hits++;
      } else if (v && typeof v === "object") for (const k of Object.keys(v)) visit(v[k]);
    };
    for (const name of db.objectStoreNames) {
      const all = await new Promise((res) => {
        const r = db.transaction(name).objectStore(name).getAll();
        r.onsuccess = () => res(r.result);
      });
      all.forEach(visit);
    }
    db.close();
    return hits ? "holds it" : "clean";
  }, text);

/** What a page reported. */
function watchPage(page, label, sink) {
  page.on("console", (msg) => {
    const type = msg.type();
    if (type !== "error" && type !== "warning") return;
    const text = msg.text();
    if (POWERSYNC_TEARDOWN.test(text)) return;
    // A failed load (a 4xx the page expects, say) is a diagnosis, not a console
    // error.
    if (/^Failed to load resource/.test(text)) {
      sink.uncaught.push(
        `failed load: ${text}${msg.location()?.url ? ` (${msg.location().url.replace(BASE, "")})` : ""}`,
      );
      return;
    }
    if (/Content Security Policy/i.test(text)) {
      sink.csp.push(`[${label}] ${text}`);
      console.log(`FAIL CSP violation (${label}): ${text}`);
    }
    sink.errors.push(`[${label} console.${type}] ${text}`);
    if (type === "error") sink.uncaught.push(`console.error: ${text}`);
  });
  page.on("pageerror", (err) => {
    sink.errors.push(`[${label} exception] ${err.message}`);
    sink.uncaught.push(`uncaught: ${err.message}`);
  });
}

export const test = base.extend({
  // A fresh client IP for the default page as well.
  extraHTTPHeaders: async ({}, use) => use({ "x-forwarded-for": randomIp() }),

  /**
   * device(label, opts?) → { context, page, errors, uncaught, offline(on), close() }:
   * a new context (its own storage, its own IP). opts are Playwright context
   * options (viewport, colorScheme…), plus `offlineable: true` for a device
   * that goes offline (its traffic goes through its own proxy; `offline(on)`
   * switches it).
   */
  device: async ({ browser }, use, testInfo) => {
    const made = [];
    const csp = [];
    await use(async (label = `device ${made.length + 1}`, { offlineable = false, ...opts } = {}) => {
      // `<-loopback>`: the app is on localhost, which Chrome otherwise never proxies.
      const proxy = offlineable ? await startProxy() : null;
      const context = await browser.newContext({
        ...(proxy && { proxy: { server: proxy.server, bypass: "<-loopback>" } }),
        baseURL: BASE,
        viewport: { width: 420, height: 900 },
        timezoneId: testZone(),
        locale: "en-US",
        ...opts,
        extraHTTPHeaders: { "x-forwarded-for": randomIp(), ...opts.extraHTTPHeaders },
      });
      const sink = { errors: [], uncaught: [], csp };
      context.on("page", (p) => watchPage(p, label, sink));
      const page = await context.newPage();
      const d = {
        label,
        context,
        page,
        errors: sink.errors,
        uncaught: sink.uncaught,
        /** Cut (or restore) this device's network, workers included (needs `offlineable`). */
        offline: (on) => {
          if (!proxy) throw new Error(`${label}: offline() needs device(label, { offlineable: true })`);
          proxy.setOnline(!on);
        },
        proxy,
        close: () => context.close(),
      };
      made.push(d);
      return d;
    });
    for (const d of made) {
      if (testInfo.status !== testInfo.expectedStatus && d.uncaught.length)
        console.log(
          `[${d.label}] at ${d.page.url().replace(BASE, "")}\n  ${d.uncaught.slice(-8).join("\n  ")}`,
        );
      await d.context.close().catch(() => {});
      d.proxy?.close();
    }
    expect(csp, "Content-Security-Policy violations").toEqual([]);
  },

  // Smoke mode: only tests tagged @smoke run.
  smokeGate: [
    async ({}, use, testInfo) => {
      if (SMOKE && !testInfo.tags.includes("@smoke")) testInfo.skip(true, "smoke");
      await use();
    },
    { auto: true },
  ],
});
