import { execSync } from "node:child_process";
import { launch, openPage, sleep } from "./cdp.mjs";

// Account settings → Devices (quick-fixes slice 29, B-80; security review S-3).
//
// viewer@ signs in on three browsers (A, B, C: separate Chrome profiles, so
// separate sessions). A's Devices page lists this device first and B among
// the others; A signs B out, and B's next session check goes to sign-in.
// Then "Sign out everywhere else" ends every other session of viewer@ (C's,
// and any left by earlier runs) and leaves A signed in. Offline, the page
// says it needs a connection and shows no list.
//
// It asserts against its own sessions (their ids from get-session), and
// leaves only A's session, which it signs out at the end.

const PG_CONTAINER = process.env.PG_CONTAINER ?? "caretook-postgres-1";
const PW = process.env.SEED_USER_PASSWORD ?? "caretook-dev-password";
const EMAIL = "viewer@example.com";
const PAGE = "/app/settings/devices";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const psql = (sql) =>
  execSync(`docker exec ${PG_CONTAINER} psql -U caretook -d caretook -tAc ${JSON.stringify(sql)}`)
    .toString()
    .trim();
const sessionExists = (id) => psql(`SELECT count(*) FROM session WHERE id = '${id}'`) === "1";
const viewerSessions = () =>
  psql(
    `SELECT string_agg(s.id::text, ',') FROM session s JOIN "user" u ON u.id = s.user_id WHERE u.email = '${EMAIL}' AND s.expires_at > now()`,
  )
    .split(",")
    .filter(Boolean);

const LIST = `document.querySelector("ul[data-devices]")`;
const row = (id) => `document.querySelector('li[data-device="${id}"]')`;
const signOutButton = (id) => `${row(id)}?.querySelector("button")`;
const OTHERS = `document.querySelector("button[data-sign-out-others]")`;
const DIALOG = `document.querySelector("dialog[open]")`;
const confirmButton = `${DIALOG}?.querySelector(".btn-error")`;
const STATUS = `document.querySelector('section[data-section="devices"] [role="status"]:not([data-needs-connection])')?.textContent.trim() ?? ""`;
const pageState = `JSON.stringify({
  path: location.pathname,
  rows: [...document.querySelectorAll("li[data-device]")].map((li) => ({
    id: li.dataset.device,
    current: li.hasAttribute("data-current"),
    label: li.querySelector("[data-device-label]")?.textContent.trim(),
    text: li.textContent.trim(),
    button: li.querySelector("button")?.getAttribute("aria-label") ?? null,
  })),
  others: !!${OTHERS},
  notice: document.querySelector("[data-needs-connection]")?.textContent.trim() ?? null,
})`;
const state = async (p) => JSON.parse(await p.evaluate(pageState));
/** This page's own session id, from Better Auth. */
const sessionId = (p) =>
  p.evaluate(
    `fetch("/api/auth/get-session", { credentials: "include" }).then((r) => r.json()).then((j) => j?.session?.id ?? null)`,
  );

async function signedIn(b, label) {
  const p = await openPage(b, label);
  await p.signIn(EMAIL, PW, { home: true }).catch(async () => {
    await sleep(4000);
    await p.signIn(EMAIL, PW, { home: true });
  });
  await p.waitFor(`location.pathname.endsWith("/timeline")`, 45000);
  return p;
}

/** Settings through the account menu, then Devices in the list (420 wide). */
async function openDevices(p) {
  const trigger = `document.querySelector('header [data-region="user"] button[aria-label^="Account menu for"]')`;
  const item = `[...document.querySelectorAll('[role="menuitem"]')].find((el) => el.textContent.trim() === "Settings")`;
  await p.waitFor(trigger, 15000);
  await p.press(trigger);
  await p.waitFor(item, 5000);
  await p.press(item);
  const link = `document.querySelector('nav[data-settings-nav] a[href="${PAGE}"]')`;
  await p.waitFor(`location.pathname === "/app/settings" && ${link}`, 30000);
  await p.evaluate(`${link}.click()`);
  await p.waitFor(`location.pathname === "${PAGE}" && ${LIST}`, 30000);
}

/** Confirm the open dialog, then wait for the sign-out to finish. */
async function confirmSignOut(p, expected) {
  await p.waitFor(confirmButton, 5000);
  await p.tap(confirmButton);
  await p.waitFor(`!${DIALOG} && ${JSON.stringify(expected)} === (${STATUS})`, 15000).catch(() => {});
}

const browsers = [];
let A;
try {
  browsers.push(await launch(9831), await launch(9832), await launch(9833));
  A = await signedIn(browsers[0], "A");
  const B = await signedIn(browsers[1], "B");
  const [aId, bId] = [await sessionId(A), await sessionId(B)];
  check("two sessions to work with", !!aId && !!bId && aId !== bId, `${aId} ${bId}`);

  // 1. The list: this device first, B among the others with its own Sign out.
  await openDevices(A);
  await A.waitFor(row(bId), 10000).catch(() => {});
  let s = await state(A);
  const first = s.rows[0];
  check(
    "this device is listed first, marked, with no Sign out",
    first?.id === aId && first.current && first.text.includes("This device") && first.button === null,
    JSON.stringify(first),
  );
  check(
    "the browser and system are named",
    /^Chrome on (macOS|Linux|Windows)$/.test(first?.label ?? ""),
    first?.label,
  );
  const bRow = s.rows.find((r) => r.id === bId);
  check(
    "the other browser is listed, last active, with a named Sign out",
    !!bRow &&
      !bRow.current &&
      /Last active/.test(bRow.text) &&
      /^Sign out Chrome on .+, last active /.test(bRow.button ?? ""),
    JSON.stringify(bRow),
  );
  check("Sign out everywhere else is offered", s.others);
  check(
    "no session token reaches the page",
    !(await A.evaluate(
      `document.documentElement.outerHTML.includes(${JSON.stringify(psql(`SELECT token FROM session WHERE id = '${bId}'`))})`,
    )),
  );
  await A.screenshot("devices-420");

  // 2. Cancel keeps B; Sign out (confirmed) ends B's session.
  await A.tap(signOutButton(bId));
  await A.waitFor(DIALOG, 5000);
  const title = await A.evaluate(`${DIALOG}.querySelector("h2").textContent.trim()`);
  check("Sign out asks first, naming the device", /^Sign out Chrome on .+\?$/.test(title), title);
  await A.tap(`${DIALOG}.querySelector(".modal-action .btn:not(.btn-error)")`);
  await A.waitFor(`!${DIALOG}`, 5000);
  check("Cancel signs nothing out", sessionExists(bId) && (await A.evaluate(`!!${row(bId)}`)));
  await A.tap(signOutButton(bId));
  await confirmSignOut(A, `Signed out ${bRow?.label}.`);
  await A.waitFor(`!${row(bId)}`, 10000).catch(() => {});
  check("B is gone from the list", !(await A.evaluate(`!!${row(bId)}`)), JSON.stringify(await state(A)));
  check("B's session is gone on the server", !sessionExists(bId));
  check("A says so", (await A.evaluate(STATUS)) === `Signed out ${bRow?.label}.`, await A.evaluate(STATUS));

  // 3. B's next session check goes to sign-in.
  await B.goto("/app");
  const bOut = await B.waitFor(`location.pathname === "/sign-in"`, 30000).then(
    () => true,
    () => false,
  );
  check("B's next session check goes to sign-in", bOut, await B.evaluate("location.pathname"));

  // 4. Sign out everywhere else: C (and any older sessions) end, A stays.
  const C = await signedIn(browsers[2], "C");
  const cId = await sessionId(C);
  await A.goto(PAGE);
  await A.waitFor(`${LIST} && ${row(cId)}`, 30000).catch(() => {});
  s = await state(A);
  check(
    "a new sign-in shows up in the list",
    s.rows.some((r) => r.id === cId),
    JSON.stringify(s.rows.map((r) => r.id)),
  );
  await A.tap(OTHERS);
  await A.waitFor(DIALOG, 5000);
  check(
    "Sign out everywhere else asks first, and says this device stays",
    /This device stays signed in/.test(await A.evaluate(`${DIALOG}.textContent`)),
  );
  await confirmSignOut(A, "Signed out everywhere else.");
  await A.waitFor(`document.querySelectorAll("li[data-device]").length === 1`, 10000).catch(() => {});
  s = await state(A);
  check(
    "only this device is left, and nothing else to sign out",
    s.rows.length === 1 && s.rows[0].id === aId && !s.others,
    JSON.stringify(s),
  );
  const left = viewerSessions();
  check("the server has only A's session", left.length === 1 && left[0] === aId, left.join());
  await A.goto(PAGE);
  const aIn = await A.waitFor(`location.pathname === "${PAGE}" && ${LIST}`, 30000).then(
    () => true,
    () => false,
  );
  check("A is still signed in after a reload", aIn, await A.evaluate("location.pathname"));
  await C.goto("/app");
  const cOut = await C.waitFor(`location.pathname === "/sign-in"`, 30000).then(
    () => true,
    () => false,
  );
  check("C goes to sign-in", cOut);

  // 5. Offline: a notice, and no list. Back online, the list returns.
  await A.evaluate(
    `document.querySelector('nav[data-settings-nav] a[href="/app/settings"], main a[href="/app/settings"]')?.click()`,
  );
  await A.waitFor(`location.pathname === "/app/settings"`, 10000);
  await A.offline(true);
  await A.evaluate(`document.querySelector('nav[data-settings-nav] a[href="${PAGE}"]').click()`);
  await A.waitFor(
    `location.pathname === "${PAGE}" && document.querySelector("[data-needs-connection]")`,
    15000,
  ).catch(() => {});
  s = await state(A);
  check(
    "offline: needs a connection, and no list",
    s.path === PAGE && /Needs a connection/.test(s.notice ?? "") && s.rows.length === 0,
    JSON.stringify(s),
  );
  await A.screenshot("devices-offline-420");
  await A.offline(false);
  const back = await A.waitFor(`${LIST} && !document.querySelector("[data-needs-connection]")`, 15000).then(
    () => true,
    () => false,
  );
  check("back online: the list returns", back);

  const errors = [...A.uncaught, ...B.uncaught, ...C.uncaught].filter(
    (e) => !/PowerSync|WebSocket|Failed to fetch|ERR_INTERNET_DISCONNECTED|401|net::/i.test(e),
  );
  check("no unexpected errors", errors.length === 0, errors.slice(0, 3).join(" | ").slice(0, 500));
} catch (e) {
  check("ran to the end", false, e.message);
} finally {
  try {
    await A?.signOut();
    await sleep(1000);
  } catch {
    // Already gone.
  }
  for (const b of browsers) b.proc.kill();
}

console.log(`${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
