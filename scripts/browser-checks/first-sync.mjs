// A fresh sign-in shows something within about a second, even when the first
// sync is slow, and a synced device never shows the syncing state (B-22).
//
// 1. Normal sign-in (fast first sync): straight to the timeline, no syncing state.
// 2. Reload a synced timeline: no syncing state.
// 3. Slow first sync (a proxy holds PowerSync's traffic for HOLD_MS): home shows
//    "Getting your care groups…" (never "not in a care group"), then goes
//    straight to the timeline once the group arrives.
// 4. Same, signing in to a deep link (the timeline): the syncing state, not a 404.
// 5. Same, deep-linking to another group route (group settings' Members): the group
//    route shows the syncing state for every screen in the group, then the page.
//
// Times are from pressing "Sign in". Run against your stack: `set -a; source .env.loop; set +a`.
import http from "node:http";
import net from "node:net";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { launch, openPage, sleep } from "./cdp.mjs";

const PASSWORD = process.env.SEED_USER_PASSWORD ?? "caretook-dev-password";
// PowerSync's URL as the app sees it (apps/web/.env), so the proxy knows which traffic to hold.
const webEnv = (() => {
  try {
    return readFileSync(new URL("../../apps/web/.env", import.meta.url), "utf8");
  } catch {
    return "";
  }
})();
const PS_URL =
  process.env.VITE_POWERSYNC_URL ??
  /^VITE_POWERSYNC_URL="?([^"\n]+)/m.exec(webEnv)?.[1] ??
  "http://localhost:8080";
const PS_PORT = String(new URL(PS_URL).port || 80);
const HOLD_MS = Number(process.env.HOLD_MS ?? 4000);
const PROXY_PORT = 9351 + Number(process.env.CDP_PORT_OFFSET ?? 0);

// A forward proxy that holds new PowerSync requests while `held`, and passes everything else.
let held = false;
const waiting = [];
const whenReleased = () => (held ? new Promise((r) => waiting.push(r)) : Promise.resolve());
const release = () => {
  held = false;
  for (const r of waiting.splice(0)) r();
};
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url);
  if (url.port === PS_PORT) await whenReleased();
  const up = http.request(
    {
      host: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method: req.method,
      headers: req.headers,
    },
    (r) => {
      res.writeHead(r.statusCode, r.headers);
      r.pipe(res);
    },
  );
  up.on("error", () => res.destroy());
  req.pipe(up);
});
server.on("upgrade", async (req, socket, head) => {
  const url = new URL(req.url);
  if (url.port === PS_PORT) await whenReleased();
  const up = net.connect(url.port || 80, url.hostname, () => {
    up.write(
      `${req.method} ${url.pathname}${url.search} HTTP/1.1\r\n` +
        Object.entries(req.headers)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\r\n") +
        "\r\n\r\n",
    );
    up.write(head);
    socket.pipe(up).pipe(socket);
  });
  up.on("error", () => socket.destroy());
  socket.on("error", () => up.destroy());
});
server.listen(PROXY_PORT, "127.0.0.1");
const proxyArgs = [`--proxy-server=http://127.0.0.1:${PROXY_PORT}`, "--proxy-bypass-list=<-loopback>"];

// Records, from the moment it's installed, when each milestone first happens.
const RECORDER = `(() => {
  const t0 = performance.now(); const m = (window.__m = { seenPending: false, seenNoGroup: false, seen404: false });
  const tick = () => {
    const t = Math.round(performance.now() - t0);
    const text = document.body?.innerText ?? "";
    if (window.caretookSync && m.dbOpen == null) m.dbOpen = t;
    if (window.caretookSync?.powersync.currentStatus.hasSynced && m.hasSynced == null) m.hasSynced = t;
    if (location.pathname !== "/sign-in" && m.leftSignIn == null) m.leftSignIn = t;
    if (document.querySelector("[data-first-sync-pending]")) { m.seenPending = true; m.pending ??= t; }
    if (text.includes("not in a care group")) m.seenNoGroup = true;
    if (text.includes("Not found")) m.seen404 = true;
    if (document.querySelector(window.__ready || "ol > li") && m.firstRow == null) m.firstRow = t;
    requestAnimationFrame(tick);
  };
  tick(); return true; })()`;

// caretaker@'s care group, for the deep link. caretaker@ has one group (member@
// has two since app-shell slice 3, so its /app is the group list).
const groupId = execFileSync("docker", [
  "exec",
  process.env.PG_CONTAINER,
  "psql",
  "-U",
  "caretook",
  "-d",
  "caretook",
  "-tAc",
  "SELECT g.id FROM care_group g JOIN care_group_member m ON m.group_id = g.id JOIN \"user\" u ON u.id = m.user_id WHERE u.email = 'caretaker@example.com' LIMIT 1",
])
  .toString()
  .trim();

const failures = [];
const expect = (ok, what) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failures.push(what);
};

// What shows that a page has rendered: a timeline row, or a member in group settings.
const READY = { timeline: "ol > li", "settings/members": "[data-section=members] li" };

const signInTimed = async (p, redirectTo, holdSync = false, ready = READY.timeline) => {
  // Better Auth rate-limits sign-in (3 per 10 s), and its error reads like a wrong password.
  await sleep(4000);
  await p.goto(redirectTo ? `/sign-in?redirectTo=${encodeURIComponent(redirectTo)}` : "/sign-in");
  await p.waitFor(`document.querySelector('input[name="email"]')`);
  await p.type(`document.querySelector('input[name="email"]')`, "caretaker@example.com");
  await p.type(`document.querySelector('input[name="password"]')`, PASSWORD);
  await p.evaluate(`window.__ready = ${JSON.stringify(ready)}`);
  await p.evaluate(RECORDER);
  if (holdSync) {
    held = true;
    setTimeout(release, HOLD_MS);
  }
  await p.press(`document.querySelector('form button[type="submit"]')`);
  await p.waitFor(`window.__m.firstRow != null`, 30000).catch(async (e) => {
    console.log(
      "stuck at",
      await p.evaluate("location.pathname"),
      await p.evaluate("JSON.stringify(window.caretookSync?.powersync.currentStatus.toJSON())"),
      await p.evaluate(`JSON.stringify(window.__m)`),
    );
    console.log((await p.evaluate("document.body.innerText")).slice(0, 300), p.errors);
    await p.screenshot("first-sync-stuck");
    throw e;
  });
  await sleep(300);
  return JSON.parse(await p.evaluate(`JSON.stringify(window.__m)`));
};

const b = await launch(9361, proxyArgs);
const errors = [];
try {
  // 1. Fast first sync.
  {
    const p = await openPage(b, "fast");
    const m = await signInTimed(p);
    console.log("fast sign-in:", JSON.stringify(m));
    expect(
      !m.seenPending && !m.seenNoGroup,
      "a normal sign-in shows no syncing state and no 'not in a care group'",
    );
    expect(
      /\/timeline$/.test(await p.evaluate("location.pathname")),
      "a normal sign-in lands on the timeline",
    );

    // 2. Reload the synced timeline.
    const path = await p.evaluate("location.pathname");
    await p.send("Page.addScriptToEvaluateOnNewDocument", { source: RECORDER });
    await p.goto(path);
    await p.waitFor(`window.__m?.firstRow != null`, 20000);
    await sleep(500);
    const r = JSON.parse(await p.evaluate(`JSON.stringify(window.__m)`));
    console.log("synced reload:", JSON.stringify(r));
    expect(!r.seenPending, "a synced device opens the timeline with no syncing state");
    errors.push(...p.errors);
    p.close();
  }
  // Each signed-in tab's PowerSync lives in a shared worker; a new Chrome profile gives a fresh device.
  b.proc.kill();

  for (const deepLink of [null, "timeline", "settings/members"]) {
    const c = await launch(9362, proxyArgs);
    try {
      const p = await openPage(c, deepLink ? "slow-deep" : "slow");
      const redirectTo = deepLink ? `/app/groups/${groupId}/${deepLink}` : null;
      const m = await signInTimed(p, redirectTo, true, READY[deepLink ?? "timeline"]);
      console.log(
        `slow sign-in${deepLink ? ` (deep link to ${deepLink})` : ""}, PowerSync held ${HOLD_MS} ms:`,
        JSON.stringify(m),
      );
      expect(
        m.pending != null && m.pending - m.dbOpen < 1500,
        "a slow first sync shows the syncing state within ~1 s of the database opening",
      );
      expect(!m.seenNoGroup, "home never says 'not in a care group' before the first sync");
      expect(!m.seen404, "a deep link isn't a 404 before the first sync");
      const end = deepLink ?? "timeline";
      expect(
        (await p.evaluate("location.pathname")).endsWith(`/${end}`),
        `it still ends on the ${end === "settings/members" ? "group settings' Members" : "timeline"}`,
      );
      expect(
        !(await p.evaluate(`!!document.querySelector("[data-first-sync-pending]")`)),
        "the syncing state goes once synced",
      );
      errors.push(...p.errors);
      await p.screenshot(`first-sync-${deepLink ? `deep-${deepLink.replace("/", "-")}` : "home"}`);
    } finally {
      release();
      c.proc.kill();
    }
  }
} finally {
  b.proc.kill();
  server.close();
}
console.log("errors:", errors);
if (failures.length) {
  console.log(`${failures.length} failed`);
  process.exit(1);
}
console.log("all passed");
process.exit(0);
