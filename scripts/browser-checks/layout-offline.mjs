import { execSync } from "node:child_process";
import { launch, openPage, sleep } from "./cdp.mjs";
import { startProxy } from "./proxy.mjs";

// A timeline layout change made offline isn't lost (quick-fixes slice 2):
// it's kept pending on the device, survives a revisit while offline, and
// reaches the server on the next online load. Online it saves at once, and
// sign-out clears pending changes.
//
// The proxy cuts the whole browser's network (the rpc call is what matters).
// A full page reload can't load at all while offline (there's no service
// worker yet), so "reload while offline" is a revisit inside the app: open a
// note, then go back, which runs the timeline's clientLoader again.

const PG_CONTAINER = process.env.PG_CONTAINER ?? "caretook-postgres-1";
const PW = process.env.SEED_USER_PASSWORD ?? "caretook-dev-password";
const EMAIL = "member@example.com";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const psql = (sql) =>
  execSync(`docker exec ${PG_CONTAINER} psql -U caretook -d caretook -tAc ${JSON.stringify(sql)}`)
    .toString()
    .trim();
const serverView = () =>
  psql(`SELECT coalesce(preferences->>'timelineView', 'rows') FROM "user" WHERE email = '${EMAIL}'`);

const rows = `document.querySelectorAll("ol > li").length`;
const isCards = `document.querySelector("ol")?.className.includes("space-y-2")`;
const pendingKeys = `Object.keys(localStorage).filter((k) => k.startsWith("caretook:settings-pending:"))`;
const pendingView = `(() => { const k = ${pendingKeys}[0]; return k ? JSON.parse(localStorage.getItem(k)).timelineView ?? null : null; })()`;
const noteRow = `[...document.querySelectorAll("ol > li")].find((li) => li.querySelector(".sr-only")?.textContent === "Note: ")`;

async function setView(p, view) {
  await p.press(`document.querySelector('[aria-label="${view}"]')`);
  await p.waitFor(`${isCards} === ${view === "Cards"}`, 5000);
}

/** Open a note, then go back to the timeline (its clientLoader runs again). */
async function revisit(p, timeline) {
  await p.press(`${noteRow}.querySelector("a")`);
  await p.waitFor(`/\\/entries\\//.test(location.pathname)`, 15000);
  await sleep(500);
  await p.evaluate("history.back()");
  await p.waitFor(`location.pathname === ${JSON.stringify(timeline)} && ${rows} > 0`, 15000);
  await sleep(300);
}

psql(`UPDATE "user" SET preferences = preferences - 'timelineView' WHERE email = '${EMAIL}'`);

const proxy = startProxy(9351);
const b = await launch(9352, proxy.args);
try {
  const p = await openPage(b, "member");
  await p.signIn(EMAIL, PW);
  await p.waitFor(`${rows} > 0`, 20000);
  await sleep(500);
  const timeline = await p.evaluate("location.pathname");
  check("starts in rows", !(await p.evaluate(isCards)) && serverView() === "rows");

  // Online: saved straight away, nothing pending.
  await setView(p, "Cards");
  await sleep(1000);
  check("online: the server has cards at once", serverView() === "cards", serverView());
  check("online: nothing left pending", (await p.evaluate(`${pendingKeys}.length`)) === 0);
  await setView(p, "Rows");
  await sleep(1000);
  check("online: switching back saves too", serverView() === "rows", serverView());

  // Open a note once while online, so its page's code is loaded (in dev, Vite
  // serves each module on first use; a built app has them all).
  await revisit(p, timeline);

  // Offline: switch to cards.
  proxy.setOnline(false);
  await sleep(300);
  await setView(p, "Cards");
  await sleep(800);
  check("offline: the change is pending", (await p.evaluate(pendingView)) === "cards");
  check("offline: the server still has rows", serverView() === "rows", serverView());

  // Offline revisit: leave the timeline and come back.
  await revisit(p, timeline);
  check("offline: still cards after leaving and coming back", await p.evaluate(isCards));

  // Back online: a real reload sends the pending change first.
  proxy.setOnline(true);
  await sleep(500);
  await p.goto(timeline);
  await p.waitFor(`${rows} > 0`, 20000);
  await sleep(300);
  check("online again: still cards after a reload", await p.evaluate(isCards));
  check("online again: the server has cards", serverView() === "cards", serverView());
  check("online again: nothing left pending", (await p.evaluate(`${pendingKeys}.length`)) === 0);
  await p.screenshot("layout-offline-cards");

  // Sign-out clears pending changes (one left by an offline switch).
  proxy.setOnline(false);
  await sleep(300);
  await setView(p, "Rows");
  await sleep(800);
  const before = await p.evaluate(`${pendingKeys}.length`);
  proxy.setOnline(true);
  await sleep(300);
  await p.press(`[...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Sign out")`);
  await p.waitFor(`location.pathname === "/sign-in"`, 15000);
  await sleep(500);
  check(
    "sign-out clears pending changes",
    before === 1 && (await p.evaluate(`${pendingKeys}.length`)) === 0,
    `pending before: ${before}`,
  );

  // Errors from requests cut on purpose (and PowerSync's dropped stream) are expected.
  const noise =
    /Failed to fetch|ERR_|net::|NetworkError|WebSocket|PowerSync|sync|error closing database connection|vite/i;
  const errors = p.errors.filter((e) => !noise.test(e));
  check("no unexpected console errors", errors.length === 0, errors.slice(0, 3).join(" | ").slice(0, 500));
} catch (e) {
  console.log("ERROR", e.message);
  results.push(false);
} finally {
  psql(`UPDATE "user" SET preferences = preferences - 'timelineView' WHERE email = '${EMAIL}'`);
  b.proc.kill();
  proxy.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
}
