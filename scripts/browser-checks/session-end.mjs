import { execSync } from "node:child_process";
import { launch, localCopyHolds, openPage, sleep } from "./cdp.mjs";
import { startProxy } from "./proxy.mjs";

// The device copy ends with the session (quick-fixes slice 28, S-2):
// - offline, the cached user carries on only within 3 days of the last
//   confirmed session check; past that, sign-in with a message, and the
//   local copy stays (unsynced writes still upload after signing back in);
// - online, every check restarts the 3 days;
// - when the server says the session has ended, the device's copy is wiped
//   (the sign-out path) and the app goes to sign-in.
//
// A full reload can't load while offline (no service worker yet), so the
// offline step is an in-app navigation: a kind filter link on the timeline,
// whose route module is already loaded, runs the /app session check again.

const PG_CONTAINER = process.env.PG_CONTAINER ?? "caretook-postgres-1";
const PW = process.env.SEED_USER_PASSWORD ?? "caretook-dev-password";
const EMAIL = "caretaker@example.com";
const DAY = 24 * 60 * 60 * 1000;

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const psql = (sql) =>
  execSync(`docker exec ${PG_CONTAINER} psql -U caretook -d caretook -tAc ${JSON.stringify(sql)}`)
    .toString()
    .trim();

const keys = `Object.keys(localStorage).filter((k) => k.startsWith("caretook:"))`;
const confirmedKey = `${keys}.find((k) => k.startsWith("caretook:session-confirmed:"))`;
const statusText = `document.querySelector('[role="status"]')?.textContent ?? ""`;
const OFFLINE_MESSAGE = "You've been offline for 3 days. Sign in to keep going.";

const proxy = startProxy(9391);
const b = await launch(9392, proxy.args);
try {
  const p = await openPage(b, "caretaker");
  await p.signIn(EMAIL, PW);
  await p.waitFor(`document.querySelectorAll("ol > li").length > 0`, 30000);
  await sleep(1000);
  const timeline = await p.evaluate("location.pathname");
  const confirmed = await p.evaluate(`Number(localStorage.getItem(${confirmedKey}))`);
  check("an online check records when it was confirmed", Date.now() - confirmed < 60_000, String(confirmed));

  // Offline, 4 days since the last confirmed check: sign-in, data kept.
  await p.evaluate(`localStorage.setItem(${confirmedKey}, String(Date.now() - ${4 * DAY}))`);
  proxy.setOnline(false);
  await sleep(300);
  const chip = `document.querySelector('main a[href*="kind=symptom"]')`;
  await p.waitFor(chip, 5000);
  await p.evaluate(`${chip}.click()`);
  await p.waitFor(`location.pathname === "/sign-in"`, 15000);
  await p.waitFor(`${statusText}.includes(${JSON.stringify(OFFLINE_MESSAGE)})`, 10000);
  check("offline past 3 days: sign-in says why", true);
  check(
    "offline past 3 days: comes back to the timeline after",
    (await p.evaluate(`new URLSearchParams(location.search).get("redirectTo")`))?.startsWith(timeline),
  );
  const lockedKeys = await p.evaluate(`JSON.stringify(${keys})`);
  check(
    "offline past 3 days: the cached user and local copy stay",
    lockedKeys.includes("caretook:session-user") && lockedKeys.includes("caretook:sync-owner"),
    lockedKeys,
  );
  check(
    "offline past 3 days: the database still holds the care data",
    (await p.evaluate(localCopyHolds("Grandma Pat"))) === "holds it",
  );
  check(
    "offline past 3 days: its rows are still there",
    (await p.evaluate(
      `window.caretookSync.powersync.get("SELECT count(*) n FROM timeline_entry").then((r) => r.n)`,
    )) > 0,
  );

  // Back online, still signed in: the app opens and the 3 days restart.
  proxy.setOnline(true);
  await sleep(300);
  await p.goto(timeline);
  await p.waitFor(
    `location.pathname === ${JSON.stringify(timeline)} && document.querySelectorAll("ol > li").length > 0`,
    30000,
  );
  const restarted = await p.evaluate(`Number(localStorage.getItem(${confirmedKey}))`);
  check("online again: the timeline opens, the 3 days restart", Date.now() - restarted < 60_000);

  // The session ends on the server: the next online check wipes the device.
  const deleted = psql(
    `DELETE FROM session WHERE id = (SELECT s.id FROM session s JOIN "user" u ON u.id = s.user_id WHERE u.email = '${EMAIL}' ORDER BY s.created_at DESC LIMIT 1) RETURNING id`,
  );
  check("the session row is deleted", deleted.length > 0);
  // A reload (not a new navigation, which can leave the old page and its
  // database connection in the back/forward cache).
  await p.send("Page.reload");
  await p.waitFor(`location.pathname === "/sign-in"`, 20000);
  await sleep(1500);
  const wipedKeys = await p.evaluate(`JSON.stringify(${keys})`);
  check(
    "signed out: the cached user, owner, confirmation and last group are gone",
    !/session-user|sync-owner|session-confirmed|lastGroup|settings|recentSearches/.test(wipedKeys),
    wipedKeys,
  );
  check("signed out: no message about being offline", !(await p.evaluate(statusText)).includes("offline"));
  // The file stays, vacuumed: none of the care data is left in its bytes.
  const left = await p.evaluate(localCopyHolds("Grandma Pat"));
  check("signed out: the database holds none of the care data", left === "clean" || left === "no file", left);
  // Offline, PowerSync logs its failed connection attempts: expected here.
  const errors = p.errors.filter((e) => !e.includes("[PowerSync]: Sync error"));
  check("no page errors", errors.length === 0, errors.join(" | "));
} catch (e) {
  console.log("FAIL ", e.message);
  results.push(false);
} finally {
  b.proc.kill();
  proxy.close?.();
}
const passed = results.filter(Boolean).length;
console.log(`${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
