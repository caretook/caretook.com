import { execSync } from "node:child_process";
import { launch, openPage, sleep } from "./cdp.mjs";

// The timeline layout choice in Settings (app-shell slice 7): Rows or Cards
// in Settings (/app/settings/timeline) changes the same preference as the timeline's toggle.
// Choosing Cards in Settings shows cards on the timeline; flipping the
// timeline's toggle back shows Rows in Settings (opened at once, so the save
// may still be in flight); and the choice follows the account to a second
// signed-in browser, both ways.
//
// It runs as caretaker@ (one group, so /app is its timeline), and puts the
// account's `timelineView` back to what it found.

const PG_CONTAINER = process.env.PG_CONTAINER ?? "caretook-postgres-1";
const PW = process.env.SEED_USER_PASSWORD ?? "caretook-dev-password";
const EMAIL = "caretaker@example.com";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const psql = (sql) =>
  execSync(`docker exec ${PG_CONTAINER} psql -U caretook -d caretook -tAc ${JSON.stringify(sql)}`)
    .toString()
    .trim();
/** The stored preference: "rows", "cards", or "" when it was never set. */
const storedView = () =>
  psql(`SELECT coalesce(preferences->>'timelineView', '') FROM "user" WHERE email = '${EMAIL}'`);
const storeView = (view) =>
  psql(
    view
      ? `UPDATE "user" SET preferences = coalesce(preferences, '{}'::jsonb) || '{"timelineView":"${view}"}'::jsonb WHERE email = '${EMAIL}'`
      : `UPDATE "user" SET preferences = preferences - 'timelineView' WHERE email = '${EMAIL}'`,
  );

const TRIGGER = `document.querySelector('header [data-region="user"] button[aria-label^="Account menu for"]')`;
const menuItem = (text) =>
  `[...document.querySelectorAll('[role="menuitem"]')].find((el) => el.textContent.trim() === ${JSON.stringify(text)})`;
const rows = `document.querySelectorAll("ol > li").length`;
const isCards = `document.querySelector("ol")?.className.includes("space-y-2")`;
const GROUP = `document.querySelector('[role="radiogroup"]')`;
const radio = (label) => `document.querySelector('input[name="timelineView"][aria-label="${label}"]')`;
const chosen = `[...document.querySelectorAll('input[name="timelineView"]')].filter((el) => el.checked).map((el) => el.getAttribute("aria-label")).join(",")`;
const layoutStatus = `${GROUP}?.closest("section").querySelector('[role="status"]')?.textContent.trim() ?? ""`;

/**
 * Settings through the account menu, then its Timeline layout subpage (the
 * list at 420): navigations inside the app, as a user does them.
 */
async function openSettings(p) {
  await p.waitFor(TRIGGER, 15000);
  await p.press(TRIGGER);
  await p.waitFor(menuItem("Settings"), 5000);
  await p.press(menuItem("Settings"));
  const link = `document.querySelector('nav[data-settings-nav] a[href="/app/settings/timeline"]')`;
  await p.waitFor(`location.pathname === "/app/settings" && ${link}`, 30000);
  await p.evaluate(`${link}.click()`);
  await p.waitFor(`location.pathname === "/app/settings/timeline" && ${GROUP}`, 30000);
}
/** The timeline through the header's Caretook link (caretaker@ has one group). */
async function openTimeline(p) {
  await p.evaluate(`document.querySelector('header [data-region="group"] a[href="/app"]').click()`);
  await p.waitFor(`location.pathname.endsWith("/timeline") && ${rows} > 0`, 30000);
  await sleep(300);
}
async function choose(p, label) {
  await p.evaluate(`${radio(label)}.click()`);
  await p.waitFor(`${layoutStatus} === "Saved."`, 15000);
}
async function signedIn(b, label) {
  const p = await openPage(b, label);
  // On a fresh dev server the first load can fail while Vite optimises its deps: one retry.
  await p.signIn(EMAIL, PW).catch(async () => {
    await sleep(4000);
    await p.signIn(EMAIL, PW);
  });
  await p.waitFor(`location.pathname.endsWith("/timeline") && ${rows} > 0`, 45000);
  await sleep(500);
  return p;
}

const found = storedView();
storeView("rows");

const browsers = [];
try {
  browsers.push(await launch(9381));
  const A = await signedIn(browsers[0], "A");
  check("starts in rows on the timeline", !(await A.evaluate(isCards)));

  // 1. Settings shows the current layout, as a named choice.
  await openSettings(A);
  check("settings: Rows is chosen", (await A.evaluate(chosen)) === "Rows", await A.evaluate(chosen));
  const named = await A.evaluate(
    `document.getElementById(${GROUP}.getAttribute("aria-labelledby"))?.textContent.trim()`,
  );
  check('settings: the choice is named "Timeline layout"', named === "Timeline layout", named);
  check(
    "settings: Rows and Cards are the options",
    (await A.evaluate(
      `[...document.querySelectorAll('input[name="timelineView"]')].map((el) => el.getAttribute("aria-label")).join(",")`,
    )) === "Rows,Cards",
  );

  // 2. Cards in Settings, then the timeline shows cards.
  await choose(A, "Cards");
  check("settings: Cards saves at once", storedView() === "cards", storedView());
  check("settings: Cards is chosen", (await A.evaluate(chosen)) === "Cards");
  await A.screenshot("settings-layout");
  await openTimeline(A);
  check("timeline: shows cards after choosing Cards in Settings", await A.evaluate(isCards));

  // 3. The timeline's toggle back to Rows, then Settings straight away.
  await A.press(`document.querySelector('[aria-label="Rows"]')`);
  await A.waitFor(`!${isCards}`, 5000);
  await openSettings(A);
  check(
    "settings: shows Rows after the timeline's toggle",
    (await A.evaluate(chosen)) === "Rows",
    await A.evaluate(chosen),
  );
  check("the server has rows", storedView() === "rows", storedView());

  // 4. The choice follows the account to another signed-in browser.
  await choose(A, "Cards");
  await sleep(4000); // Better Auth's sign-in rate limit.
  browsers.push(await launch(9382));
  const B = await signedIn(browsers[1], "B");
  check("second browser: the timeline shows cards", await B.evaluate(isCards));
  await openSettings(B);
  check("second browser: Settings shows Cards", (await B.evaluate(chosen)) === "Cards");
  await choose(B, "Rows");
  await openTimeline(A);
  check("first browser: the timeline follows the second's choice", !(await A.evaluate(isCards)));
  await openSettings(A);
  check("first browser: Settings shows Rows", (await A.evaluate(chosen)) === "Rows");

  const errors = [...A.errors, ...B.errors].filter((e) => !/vite|PowerSync|WebSocket/i.test(e));
  check("no unexpected console errors", errors.length === 0, errors.slice(0, 3).join(" | ").slice(0, 500));
} catch (e) {
  console.log("ERROR", e.message);
  results.push(false);
} finally {
  storeView(found);
  for (const b of browsers) b.proc.kill();
  console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
  process.exit(results.every(Boolean) ? 0 : 1);
}
