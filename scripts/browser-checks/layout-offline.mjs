import { execSync } from "node:child_process";
import { launch, openPage, sleep } from "./cdp.mjs";
import { startProxy } from "./proxy.mjs";

// A timeline layout change made offline isn't lost (quick-fixes slice 2):
// it's kept pending on the device, survives a revisit while offline, and
// reaches the server on the next online load. Online it saves at once, and
// sign-out clears pending changes. The layout also follows the account: a
// change made in another browser shows on this one's next load, over its own
// cached copy (from settings-layout.mjs; the Settings <-> timeline toggle on
// one device is settings.browser.test.tsx's).
//
// Units save the same way (quick-fixes slice 30): °F → °C chosen offline in
// Settings is pending, the vitals sheet shows °C at once, and the next online
// load sends it.
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
const isCards = `(document.querySelector("ol")?.dataset.view === "cards")`;
const setServerView = (view) =>
  psql(
    `UPDATE "user" SET preferences = coalesce(preferences, '{}'::jsonb) || '{"timelineView":"${view}"}'::jsonb WHERE email = '${EMAIL}'`,
  );

const pendingKeys = `Object.keys(localStorage).filter((k) => k.startsWith("caretook:settings-pending:"))`;
const pendingView = `(() => { const k = ${pendingKeys}[0]; return k ? JSON.parse(localStorage.getItem(k)).timelineView ?? null : null; })()`;
const serverTemp = () =>
  psql(`SELECT coalesce(preferences->'units'->>'temperature', 'f') FROM "user" WHERE email = '${EMAIL}'`);
const pendingTemp = `(() => { const k = ${pendingKeys}[0]; return k ? JSON.parse(localStorage.getItem(k)).units?.temperature ?? null : null; })()`;
const TRIGGER = `document.querySelector('header [data-region="user"] button[aria-label^="Account menu for"]')`;
const menuItem = (text) =>
  `[...document.querySelectorAll('[role="menuitem"]')].find((el) => el.textContent.trim() === ${JSON.stringify(text)})`;
const tempRadio = (unit) => `document.querySelector('input[name="temperature"][value="${unit}"]')`;
const button = (text, scope = "document") =>
  `[...${scope}.querySelectorAll("button")].find((b) => b.textContent.trim() === ${JSON.stringify(text)})`;
const DIALOG = `document.querySelector("[role=dialog]")`;
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

const resetPrefs = () =>
  psql(`UPDATE "user" SET preferences = preferences - 'timelineView' - 'units' WHERE email = '${EMAIL}'`);
resetPrefs();

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

  // Units: open Settings → Units inside the app while online (so the
  // timeline's code stays loaded), then go offline and choose °C.
  check("units: the server starts in °F", serverTemp() === "f", serverTemp());
  await p.waitFor(TRIGGER, 15000);
  await p.press(TRIGGER);
  await p.waitFor(menuItem("Settings"), 5000);
  await p.press(menuItem("Settings"));
  const unitsLink = `document.querySelector('nav[data-settings-nav] a[href="/app/settings/units"]')`;
  await p.waitFor(`location.pathname === "/app/settings" && ${unitsLink}`, 30000);
  await p.evaluate(`${unitsLink}.click()`);
  await p.waitFor(`location.pathname === "/app/settings/units" && ${tempRadio("c")}`, 30000);
  check("units: °F is chosen", await p.evaluate(`${tempRadio("f")}.checked`));

  proxy.setOnline(false);
  await sleep(300);
  await p.evaluate(`${tempRadio("c")}.click()`);
  await p.press(button("Save"));
  const unitsStatus = `document.querySelector('form [role="status"]')?.textContent.trim() ?? ""`;
  await p.waitFor(`${unitsStatus}.startsWith("Saved on this device")`, 10000).then(
    () => check("units offline: saved on this device, to sync later", true),
    async () =>
      check("units offline: saved on this device, to sync later", false, await p.evaluate(unitsStatus)),
  );
  check("units offline: °C is pending", (await p.evaluate(pendingTemp)) === "c");
  check("units offline: the server still has °F", serverTemp() === "f", serverTemp());
  check(
    "units offline: no offline error",
    !(await p.evaluate(`!!document.querySelector('form [role="alert"]')`)),
  );

  // Back to the timeline (still offline), then the vitals sheet's temperature.
  await p.evaluate("history.go(-2)");
  await p.waitFor(`location.pathname === ${JSON.stringify(timeline)} && ${rows} > 0`, 15000);
  await sleep(300);
  await p.addToTimeline("Temperature");
  await p.waitFor(
    `${DIALOG} && ${DIALOG}.querySelector('input[name="vital.0.type"]')?.value === "temperature"`,
    10000,
  );
  const sheetUnits = `[...${DIALOG}.querySelectorAll(".label")].map((el) => el.textContent.trim()).join(",")`;
  check(
    "units offline: the vitals sheet shows °C at once",
    (await p.evaluate(`${sheetUnits}.includes("°C") && !${sheetUnits}.includes("°F")`)) === true,
    await p.evaluate(sheetUnits),
  );
  await p.press(button("Cancel", DIALOG));
  await p.waitFor(`!${DIALOG}`, 5000).catch(() => {});

  // Back online: the next load sends it. Meanwhile the account's layout is
  // changed elsewhere (another signed-in browser; here straight on the
  // server): the load shows the account's choice over this device's copy.
  proxy.setOnline(true);
  await sleep(500);
  setServerView("rows");
  await p.goto(timeline);
  await p.waitFor(`${rows} > 0`, 20000);
  await sleep(300);
  check("units online again: the server has °C", serverTemp() === "c", serverTemp());
  check("units online again: nothing left pending", (await p.evaluate(`${pendingKeys}.length`)) === 0);
  check(
    "the layout follows the account: another browser's Rows shows on the next load",
    !(await p.evaluate(isCards)) && serverView() === "rows",
  );

  // Sign-out clears pending changes (one left by an offline switch).
  proxy.setOnline(false);
  await sleep(300);
  await setView(p, "Cards");
  await sleep(800);
  const before = await p.evaluate(`${pendingKeys}.length`);
  proxy.setOnline(true);
  await sleep(300);
  await p.signOut();
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
  resetPrefs();
  b.proc.kill();
  proxy.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
}
