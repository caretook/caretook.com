// Minimal CDP harness: launch headless Chrome, open pages, evaluate, screenshot.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
export const BASE = process.env.BASE ?? "http://localhost:5176";
export const OUT = new URL(".", import.meta.url).pathname;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Parallel loops shift every CDP and proxy port by CDP_PORT_OFFSET.
export const PORT_OFFSET = Number(process.env.CDP_PORT_OFFSET ?? 0);

export async function launch(basePort, extraArgs = []) {
  const port = basePort + PORT_OFFSET;
  const dir = mkdtempSync(join(tmpdir(), "cdp-"));
  const proc = spawn(CHROME, [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${dir}`,
    "--window-size=420,900",
    "--no-first-run",
    "--no-default-browser-check",
    ...extraArgs,
    "about:blank",
  ]);
  for (let i = 0; i < 150; i++) {
    try {
      const v = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
      return { proc, port, ws: v.webSocketDebuggerUrl };
    } catch {
      await sleep(200);
    }
  }
  throw new Error("Chrome didn't start");
}

export async function openPage(browser, label) {
  const res = await fetch(`http://127.0.0.1:${browser.port}/json/new?about:blank`, { method: "PUT" });
  const target = await res.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0;
  const pending = new Map();
  const listeners = [];
  const errors = [];
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    } else if (msg.method) {
      for (const l of listeners) l(msg);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const n = ++id;
      pending.set(n, { resolve, reject });
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  // Everything the page reports, for checks' own error assertions (`errors`)
  // and for a failed wait's diagnosis (`uncaught`, `diagnose()`). Vite's dev
  // client forwards console errors and uncaught errors to the server, and when
  // its socket is down it logs only "Failed to send error to Vite server",
  // which hides the real error: so take them from CDP directly, with where
  // they came from.
  const uncaught = [];
  const where = (d) => (d?.url ? ` (${d.url.replace(BASE, "")}:${(d.lineNumber ?? 0) + 1})` : "");
  // A plain object logs as "Object": show its preview's fields instead (PowerSync
  // logs its errors as objects with a name and message).
  const preview = (a) =>
    a.type === "object" && !a.subtype && a.preview?.properties?.length
      ? `{${a.preview.properties.map((p) => `${p.name}: ${p.value ?? p.type}`).join(", ")}}`
      : null;
  const argText = (a) => a.value ?? preview(a) ?? a.description ?? a.unserializableValue ?? "";
  listeners.push((msg) => {
    if (msg.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(msg.params.type)) {
      const text = msg.params.args.map(argText).join(" ");
      errors.push(`[${label} console.${msg.params.type}] ${text}`);
      if (msg.params.type === "error") uncaught.push(`console.error: ${text}`);
    }
    if (msg.method === "Runtime.exceptionThrown") {
      const d = msg.params.exceptionDetails;
      const text = d.exception?.description ?? d.text;
      errors.push(`[${label} exception] ${text}`);
      uncaught.push(`uncaught: ${text}${where(d.stackTrace?.callFrames?.[0] ?? d)}`);
    }
    if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
      const e = msg.params.entry;
      uncaught.push(`${e.source}: ${e.text}${e.url ? ` (${e.url.replace(BASE, "")})` : ""}`);
    }
  });
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Network.enable");
  // Each page is its own device, with its own client IP as real users have. A
  // built server (NODE_ENV=production) turns on Better Auth's rate limits (3
  // sign-ins per 10 s, 100 session checks per 10 s, per IP and path), and with
  // no proxy header every page would share one bucket.
  const ip = () => Math.floor(Math.random() * 254) + 1;
  await send("Network.setExtraHTTPHeaders", { headers: { "x-forwarded-for": `10.${ip()}.${ip()}.${ip()}` } });
  await send("Emulation.setDeviceMetricsOverride", {
    width: 420,
    height: 900,
    deviceScaleFactor: 1,
    mobile: true,
  });

  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails)
      throw new Error(`${label}: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value;
  };
  const goto = async (path) => {
    await send("Page.navigate", { url: BASE + path });
    await waitFor(`document.readyState === "complete"`, 15000);
  };
  /**
   * The page's state for a failed step: its URL, the errors it reported since
   * the last diagnosis (uncaught errors, rejections, console errors and failed
   * loads, newest last) and the start of `main`'s HTML.
   */
  let diagnosed = 0;
  const diagnose = async () => {
    // A page that's gone never answers, so give up after 3 s.
    const page = await Promise.race([
      evaluate(
        `JSON.stringify({ url: location.href, main: document.querySelector("main")?.outerHTML.slice(0, 600) ?? null, body: document.querySelector("main") ? undefined : document.body?.innerText.slice(0, 300) })`,
      ),
      sleep(3000).then(() => {
        throw new Error("no answer in 3 s");
      }),
    ])
      .then(JSON.parse)
      .catch((e) => ({ url: "?", main: `(can't evaluate: ${e.message})` }));
    const fresh = uncaught.slice(diagnosed).slice(-8);
    diagnosed = uncaught.length;
    return [
      `[${label}] at ${page.url.replace(BASE, "")}`,
      fresh.length ? fresh.map((e) => `  ${e.slice(0, 600)}`).join("\n") : "  (no errors reported)",
      `  main: ${page.main ?? `none; body: ${JSON.stringify(page.body ?? "")}`}`,
    ].join("\n");
  };
  /** Waits for `expression`; on a timeout, prints `diagnose()` (unless `quiet`) and throws. */
  const waitFor = async (expression, ms = 10000, { quiet = false } = {}) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      try {
        if (await evaluate(`!!(${expression})`)) return true;
      } catch {
        // Not there yet (or the page is navigating): keep polling.
      }
      await sleep(100);
    }
    if (!quiet)
      console.log(`${label}: timed out waiting for ${expression.slice(0, 200)}\n${await diagnose()}`);
    throw new Error(`${label}: timed out waiting for ${expression}`);
  };
  const screenshot = async (name) => {
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, "base64"));
  };
  const offline = (on) =>
    send("Network.emulateNetworkConditions", {
      offline: on,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });

  // React Aria buttons need pointer events before click.
  const press = (selector) =>
    evaluate(`(() => { const el = ${selector}; if (!el) throw new Error("no element: " + ${JSON.stringify(selector)});
      el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })); el.click(); return true; })()`);
  // A real tap (mouse press and release) at the centre of an element, after
  // scrolling it into view: it goes through whatever is on top, as a finger would.
  // It aims where the element is once it has stopped moving: content arriving
  // above it (a banner from a live query) can shift it after it first renders,
  // and a fast (built) server makes the tap race that shift.
  const tap = async (selector) => {
    const where = `(() => { const el = ${selector}; if (!el) return null;
      el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`;
    let point = await evaluate(where);
    if (!point) throw new Error(`${label}: nothing to tap: ${selector}`);
    for (let i = 0; i < 20; i++) {
      await sleep(100);
      const next = await evaluate(where);
      if (!next) throw new Error(`${label}: nothing to tap: ${selector}`);
      const still = next.x === point.x && next.y === point.y;
      point = next;
      if (still) break;
    }
    for (const type of ["mousePressed", "mouseReleased"]) {
      await send("Input.dispatchMouseEvent", { type, ...point, button: "left", clickCount: 1 });
    }
  };
  const type = (selector, value) =>
    evaluate(`(() => { const el = ${selector}; const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`);

  /**
   * On the `/app` group list (member@ is in two seeded groups), open Dev
   * Family's timeline: the group every check works in. A user with one group
   * is already on its timeline; one with none stays on the list.
   */
  const openDevFamily = async (ms = 45000) => {
    await waitFor(
      `location.pathname !== "/app" || document.querySelector("main h1")?.textContent === "Your care groups"`,
      ms,
    );
    const link = `[...document.querySelectorAll('main a[href$="/timeline"]')].find((a) => a.textContent.includes("Grandma Pat"))`;
    if (!(await evaluate(`location.pathname === "/app" && !!${link}`))) return;
    await evaluate(`${link}.click()`);
    await waitFor(`location.pathname.endsWith("/timeline")`, ms);
  };

  /** Sign in; then, unless `home`, go on from the group list to Dev Family (see `openDevFamily`). */
  const signIn = async (email, password, { home = false } = {}) => {
    // A 401 from the sync token endpoint leaves the device local-only (no first
    // sync), so the page would wait for groups that never come. Last guard:
    // retry once, with a log line.
    let tokenRefused = false;
    const watchToken = (msg) => {
      const { response } = msg.params ?? {};
      if (msg.method === "Network.responseReceived" && response.status === 401) {
        if (new URL(response.url).pathname === "/api/auth/token") tokenRefused = true;
      }
    };
    listeners.push(watchToken);
    const submit = async () => {
      await goto("/sign-in");
      await waitFor(`document.querySelector('input[name="email"]')`);
      await type(`document.querySelector('input[name="email"]')`, email);
      await type(`document.querySelector('input[name="password"]')`, password);
      await press(`document.querySelector('form button[type="submit"]')`);
      // The first /app load (PowerSync, cold modules) can be slow when many loops share the machine.
      await waitFor(`location.pathname.startsWith("/app")`, 45000);
    };
    try {
      await submit();
      if (tokenRefused) {
        console.log(`${label}: /api/auth/token answered 401 after signing in as ${email}; retrying once`);
        tokenRefused = false;
        await sleep(1000);
        await send("Page.reload");
        await waitFor(`document.readyState === "complete" && location.pathname !== "/"`, 15000);
        if (await evaluate(`location.pathname === "/sign-in"`)) await submit();
        else await waitFor(`location.pathname.startsWith("/app")`, 45000);
        if (tokenRefused) console.log(`${label}: /api/auth/token answered 401 again`);
      }
    } finally {
      listeners.splice(listeners.indexOf(watchToken), 1);
    }
    if (!home) await openDevFamily();
  };

  /** Sign out through the header's account menu (app-shell slice 1). */
  const signOut = async () => {
    const trigger = `document.querySelector('header [data-region="user"] button[aria-label^="Account menu for"]')`;
    const item = `[...document.querySelectorAll('[role="menuitem"]')].find((el) => el.textContent.trim() === "Sign out")`;
    await waitFor(trigger, 15000);
    await press(trigger);
    await waitFor(item, 5000);
    await press(item);
  };

  return {
    send,
    evaluate,
    goto,
    waitFor,
    screenshot,
    offline,
    press,
    tap,
    type,
    signIn,
    openDevFamily,
    signOut,
    errors,
    uncaught,
    diagnose,
    close: () => ws.close(),
  };
}

/**
 * Smoke mode (`SMOKE=1`; `pnpm prd browser --smoke` sets it): each check runs
 * only its core path (one role, one happy path, no offline, no second device),
 * in about 20 s. Hand-offs and landings run the full check.
 */
export const SMOKE = process.env.SMOKE === "1";

/**
 * A block of a check's steps: `await step(name, fn)`, or `step(name, { smoke:
 * true }, fn)` for a block on the core path. In smoke mode a block that isn't
 * marked smoke is skipped, with one "SKIP" line, and returns `skipped`
 * instead of `fn`'s result. Full mode runs every block.
 */
export async function step(name, opts, fn) {
  if (typeof opts === "function") [fn, opts] = [opts, {}];
  if (SMOKE && !opts.smoke) {
    console.log(`SKIP  ${name} (smoke)`);
    return opts.skipped;
  }
  return fn();
}
