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
  for (let i = 0; i < 50; i++) {
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
  listeners.push((msg) => {
    if (msg.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(msg.params.type)) {
      const text = msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ");
      errors.push(`[${label} console.${msg.params.type}] ${text}`);
    }
    if (msg.method === "Runtime.exceptionThrown") {
      errors.push(
        `[${label} exception] ${msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text}`,
      );
    }
  });
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
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
  const waitFor = async (expression, ms = 10000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      try {
        if (await evaluate(`!!(${expression})`)) return true;
      } catch {
        // Not there yet (or the page is navigating): keep polling.
      }
      await sleep(100);
    }
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
  const type = (selector, value) =>
    evaluate(`(() => { const el = ${selector}; const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`);

  const signIn = async (email, password) => {
    await goto("/sign-in");
    await waitFor(`document.querySelector('input[name="email"]')`);
    await type(`document.querySelector('input[name="email"]')`, email);
    await type(`document.querySelector('input[name="password"]')`, password);
    await press(`document.querySelector('form button[type="submit"]')`);
    await waitFor(`location.pathname.startsWith("/app")`, 15000);
  };

  return {
    send,
    evaluate,
    goto,
    waitFor,
    screenshot,
    offline,
    press,
    type,
    signIn,
    errors,
    close: () => ws.close(),
  };
}
