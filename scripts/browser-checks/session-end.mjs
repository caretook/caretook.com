import { execSync } from "node:child_process";
import { BASE, launch, localCopyHolds, openPage, sleep } from "./cdp.mjs";
import { startProxy } from "./proxy.mjs";

// The device copy ends with the session (quick-fixes slice 28, S-2):
// - offline, the cached user carries on only within 3 days of the last
//   confirmed session check; past that, sign-in with a message, and the
//   local copy stays (unsynced writes still upload after signing back in);
// - online, every check restarts the 3 days;
// - when the server says the session has ended, the device's copy is wiped
//   (the sign-out path) and the app goes to sign-in.
//
// The session ends as the Devices page ends one (devices.mjs's flow, B-124):
// another device of the same account, here a client of Better Auth's API
// with a bearer token, finds this browser's session in list-sessions and
// revokes it by its token. Then that device's "Sign out everywhere else"
// ends a third session and keeps its own. The page itself is component
// tests (settings/devices/devices.browser.test.tsx).
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

/** Another device of the account: Better Auth's API with a bearer token (its own address, for the rate limits). */
const octet = () => 1 + Math.floor(Math.random() * 250);
async function otherDevice() {
  const ip = `10.${octet()}.${octet()}.${octet()}`;
  const call = async (path, { token, body } = {}) => {
    const r = await fetch(`${BASE}/api/auth/${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": ip,
        origin: BASE,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, json: await r.json().catch(() => null) };
  };
  const signedIn = await call("sign-in/email", { body: { email: EMAIL, password: PW } });
  const token = signedIn.json?.token;
  if (!token) throw new Error(`the other device couldn't sign in: ${signedIn.status}`);
  return {
    call: (path, body) => call(path, { token, body }),
    alive: async () => !!(await call("get-session", { token })).json?.session,
  };
}

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

  // Another device signs this one out, as the Devices page does: the next online check wipes it.
  const pId = await p.evaluate(
    `fetch("/api/auth/get-session", { credentials: "include" }).then((r) => r.json()).then((j) => j?.session?.id ?? null)`,
  );
  const other = await otherDevice();
  const listed = (await other.call("list-sessions")).json ?? [];
  const mine = listed.find((s) => s.id === pId);
  check("the other device lists this browser's session", !!mine?.token, `${pId} in ${listed.length}`);
  const revoked = await other.call("revoke-session", { token: mine?.token });
  const gone = psql(`SELECT count(*) FROM session WHERE id = '${pId}'`) === "0";
  check(
    "signed out from the other device: the session is gone on the server",
    revoked.status === 200 && gone,
  );
  // Sign out everywhere else: a third session ends, the device that asked stays.
  const third = await otherDevice();
  await other.call("revoke-other-sessions", {});
  check(
    "sign out everywhere else: the other sessions end, the asking device stays",
    !(await third.alive()) && (await other.alive()),
  );
  await other.call("sign-out", {});
  // Quick entry's recent lines go with the rest.
  await p.evaluate(`localStorage.setItem("caretook:recentLines:x:y", JSON.stringify(["bp 120/80"]))`);
  // A reload (not a new navigation, which can leave the old page and its
  // database connection in the back/forward cache).
  await p.send("Page.reload");
  await p.waitFor(`location.pathname === "/sign-in"`, 20000);
  await sleep(1500);
  const wipedKeys = await p.evaluate(`JSON.stringify(${keys})`);
  check(
    "signed out: the cached user, owner, confirmation, last group and recent lines are gone",
    !/session-user|sync-owner|session-confirmed|lastGroup|settings|recentSearches|recentLines/.test(
      wipedKeys,
    ),
    wipedKeys,
  );
  check("signed out elsewhere: the next session check goes to sign-in", true);
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
