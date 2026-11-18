import { execSync } from "node:child_process";
import { launch, openPage, sleep } from "./cdp.mjs";

// Routing (the routing PRD): every page has its own path, nested where the UI
// is nested. Slice 1, the group route:
//
// - `/app/groups/<id>` on its own lands on the group's timeline;
// - the timeline, an entry and group settings open under the group route;
// - a non-member's group URLs (the group, its timeline, an entry, settings)
//   are each the /app 404 ("Not found"), with no names;
// - the group context is live: a recipient renamed on the server shows in the
//   page's heading, and a role changed on the server takes the entry page's
//   writer controls away, both without a reload.
//
// Slice 4, the account's settings subpages:
//
// - at 420, /app/settings is the list (Units, Timeline layout, Account); each
//   item opens its subpage, alone, with a back link to the list;
// - a subpage works as a direct link and after a reload;
// - at 1280, /app/settings opens Units beside the side nav, the current item
//   is aria-current="page", and widening the window on the list does the same;
// - Account shows the name and email, and its Sign out signs out.
//
// It runs as caretaker@ (one group) and admin@ (in no group), and puts back
// the recipient's preferred name and caretaker@'s role in `finally`.
// Run against your stack: `set -a; source .env.loop; set +a`.

const PG_CONTAINER = process.env.PG_CONTAINER ?? "caretook-postgres-1";
const PW = process.env.SEED_USER_PASSWORD ?? "caretook-dev-password";
const G = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001"; // Dev Family

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const psql = (sql) =>
  execSync(`docker exec ${PG_CONTAINER} psql -U caretook -d caretook -tAc ${JSON.stringify(sql)}`)
    .toString()
    .trim();

const caretakerRole = `(SELECT role FROM care_group_member WHERE group_id = '${G}' AND user_id = (SELECT id FROM "user" WHERE email = 'caretaker@example.com'))`;
const setCaretakerRole = (role) =>
  psql(
    `UPDATE care_group_member SET role = '${role}' WHERE group_id = '${G}' AND user_id = (SELECT id FROM "user" WHERE email = 'caretaker@example.com')`,
  );
const foundName = psql(`SELECT coalesce(preferred_name, '') FROM care_recipient WHERE group_id = '${G}'`);
const foundRole = psql(`SELECT ${caretakerRole}`);
// A note in Dev Family, to open its page.
const noteId = psql(
  `SELECT id FROM timeline_entry WHERE group_id = '${G}' AND kind = 'note' AND deleted_at IS NULL ORDER BY occurred_at DESC LIMIT 1`,
);

const h1 = `document.querySelector("main h1")?.textContent`;
const leaks = `/Grandma|Pat|Dev Family|Dev Caretaker|Dev Member/.test(document.querySelector("main")?.innerText ?? "")`;
const titleInput = `document.querySelector("main [data-region=title] input")`;

/** Where a page is, for a failed step's detail. */
const pageState = (pg) =>
  pg
    .evaluate(
      `JSON.stringify({ path: location.pathname, synced: window.caretookSync?.powersync.currentStatus.hasSynced, connected: window.caretookSync?.powersync.currentStatus.connected, editors: [...document.querySelectorAll("[contenteditable]")].map((e) => e.getAttribute("contenteditable")), main: document.querySelector("main")?.innerText.slice(0, 200) })`,
    )
    .catch(() => "?");

const SETTINGS_ITEMS = [
  { id: "units", label: "Units", path: "/app/settings/units" },
  { id: "timeline", label: "Timeline layout", path: "/app/settings/timeline" },
  { id: "account", label: "Account", path: "/app/settings/account" },
];
const settingsNav = `document.querySelector("nav[data-settings-nav]")`;
const settingsLink = (id) => `${settingsNav}?.querySelector('[data-settings-item="${id}"]')`;
const backLink = `[...document.querySelectorAll("main a")].find((a) => a.getAttribute("href") === "/app/settings" && a.textContent.trim() === "Settings")`;
/** Whether an element is laid out (not display: none, itself or above). */
const shown = (el) => `!!(${el}) && (${el}).getClientRects().length > 0`;
const settingsState = `JSON.stringify({
  path: location.pathname,
  h1: [...document.querySelectorAll("main h1")].filter((h) => h.getClientRects().length).map((h) => h.textContent.trim()),
  items: [...(${settingsNav}?.querySelectorAll("[data-settings-item]") ?? [])].map((a) => a.querySelector("span span")?.textContent.trim()),
  navShown: ${shown(settingsNav)},
  back: ${shown(backLink)},
  current: [...(${settingsNav}?.querySelectorAll("[aria-current]") ?? [])].map((a) => a.dataset.settingsItem + "=" + a.getAttribute("aria-current")),
})`;
const metrics = (p, width) =>
  p.send("Emulation.setDeviceMetricsOverride", {
    width,
    height: 900,
    deviceScaleFactor: 1,
    mobile: width < 800,
  });

/** Slice 4: the account's settings list, its subpages and the side nav (caretaker@, ends signed out). */
async function settingsSteps(p) {
  const state = async () => JSON.parse(await p.evaluate(settingsState));

  // 420: the list, then each subpage with a back link.
  await metrics(p, 420);
  await p.goto("/app/settings");
  await p.waitFor(`${settingsLink("account")}`, 30000).catch(() => {});
  let s = await state();
  check(
    "420: /app/settings is the list of three items, with no subpage and no back link",
    s.path === "/app/settings" &&
      s.navShown &&
      !s.back &&
      s.h1.join() === "Settings" &&
      (await p.evaluate(`${settingsNav}.querySelectorAll("[data-settings-item]").length`)) === 3 &&
      s.items.join() === SETTINGS_ITEMS.map((i) => i.label).join(),
    JSON.stringify(s),
  );
  await p.screenshot("routing-settings-list-420");
  for (const item of SETTINGS_ITEMS) {
    await p.waitFor(settingsLink(item.id), 10000);
    await p.evaluate(`${settingsLink(item.id)}.click()`);
    await p
      .waitFor(
        `location.pathname === "${item.path}" && document.querySelector("main h1")?.textContent.trim() === ${JSON.stringify(item.label)}`,
        20000,
      )
      .catch(() => {});
    s = await state();
    check(
      `420: ${item.label} opens ${item.path} on its own, with a back link to the list`,
      s.path === item.path && s.h1.join() === item.label && s.back && !s.navShown,
      JSON.stringify(s),
    );
    await p.evaluate(`${backLink}.click()`);
    await p.waitFor(`location.pathname === "/app/settings" && ${shown(settingsNav)}`, 10000).then(
      () => check(`420: ${item.label}'s back link returns to the list`, true),
      async () =>
        check(`420: ${item.label}'s back link returns to the list`, false, JSON.stringify(await state())),
    );
  }

  // A direct link, and a reload.
  await p.goto("/app/settings/units");
  const unitsReady = `location.pathname === "/app/settings/units" && document.querySelector('input[name="temperature"]')`;
  const direct = await p.waitFor(unitsReady, 30000).then(
    () => true,
    () => false,
  );
  check("/app/settings/units works as a direct link", direct, direct ? "" : JSON.stringify(await state()));
  await p.evaluate("location.reload()");
  await sleep(500);
  const reloaded = await p.waitFor(unitsReady, 30000).then(
    () => true,
    () => false,
  );
  check("/app/settings/units works after a reload", reloaded, reloaded ? "" : JSON.stringify(await state()));

  // 1280: the side nav beside Units.
  await metrics(p, 1280);
  await p.goto("/app/settings");
  await p
    .waitFor(
      `location.pathname === "/app/settings/units" && document.querySelector('input[name="temperature"]')`,
      30000,
    )
    .catch(() => {});
  s = await state();
  check(
    "1280: /app/settings lands on Units beside the side nav, Units current, no back link",
    s.path === "/app/settings/units" &&
      s.navShown &&
      !s.back &&
      s.h1.join() === "Units" &&
      s.current.join() === "units=page",
    JSON.stringify(s),
  );
  await p.screenshot("routing-settings-1280");
  await p.evaluate(`${settingsLink("timeline")}.click()`);
  await p
    .waitFor(
      `location.pathname === "/app/settings/timeline" && document.querySelector('[role="radiogroup"]')`,
      20000,
    )
    .catch(() => {});
  s = await state();
  check(
    "1280: the side nav switches subpages in one click, and aria-current follows",
    s.path === "/app/settings/timeline" && s.navShown && s.current.join() === "timeline=page",
    JSON.stringify(s),
  );
  const historyBefore = await p.evaluate("history.length");

  // Widening the window on the list opens the first subpage.
  await metrics(p, 420);
  await p.evaluate(`${backLink}.click()`);
  await p.waitFor(`location.pathname === "/app/settings" && ${shown(settingsNav)}`, 10000).catch(() => {});
  await metrics(p, 1280);
  await p.waitFor(`location.pathname === "/app/settings/units"`, 10000).then(
    () => check("widening the window on the list opens Units", true),
    async () => check("widening the window on the list opens Units", false, JSON.stringify(await state())),
  );
  check("…replacing the list in history", (await p.evaluate("history.length")) === historyBefore + 1);

  // Account: the name and email, and Sign out.
  await metrics(p, 420);
  await p.goto("/app/settings/account");
  await p.waitFor(`document.querySelector('main [data-field="email"]')`, 30000).catch(() => {});
  const account = JSON.parse(
    await p.evaluate(
      `JSON.stringify({ name: document.querySelector('main [data-field="name"]')?.textContent.trim(), email: document.querySelector('main [data-field="email"]')?.textContent.trim(), inputs: document.querySelectorAll("main input").length })`,
    ),
  );
  const seededName = psql(`SELECT name FROM "user" WHERE email = 'caretaker@example.com'`);
  check(
    "Account shows the name and email, read-only",
    account.name === seededName && account.email === "caretaker@example.com" && account.inputs === 0,
    JSON.stringify(account),
  );
  await p.screenshot("routing-settings-account");
  const signOut = `[...document.querySelectorAll("main button")].find((b) => b.textContent.trim() === "Sign out")`;
  await p.evaluate(`${signOut}.click()`);
  await p.waitFor(`location.pathname === "/sign-in"`, 30000).then(
    () => check("Account's Sign out signs out", true),
    async () => check("Account's Sign out signs out", false, await p.evaluate("location.pathname")),
  );
  await p.goto("/app/settings");
  await p.waitFor(`location.pathname === "/sign-in"`, 30000).then(
    () => check("…and /app/settings then asks to sign in", true),
    async () =>
      check("…and /app/settings then asks to sign in", false, await p.evaluate("location.pathname")),
  );
}

const browsers = [];
let c;
try {
  // caretaker@: a writer in Dev Family.
  browsers.push(await launch(9481));
  c = await openPage(browsers[0], "caretaker");
  await c.signIn("caretaker@example.com", PW);

  await c.goto(`/app/groups/${G}`);
  await c.waitFor(`location.pathname.endsWith("/timeline") && document.querySelector("ol > li")`, 20000).then(
    () => check("/app/groups/<id> lands on its timeline", true),
    async () => check("/app/groups/<id> lands on its timeline", false, await c.evaluate("location.pathname")),
  );
  check("the timeline's heading is the group's display name", (await c.evaluate(h1)) === "Grandma Pat");

  // A route's first visit on a fresh server can make Vite re-optimize and
  // reload the page mid-wait (AGENTS.md, Gotchas), so a miss gets one reload.
  // A real bug fails both tries; the detail says which try it was, and where
  // the page was.
  const editable = `document.querySelector("[contenteditable=true]")`;
  let entryTry = 1;
  let opened = await c
    .goto(`/app/groups/${G}/entries/${noteId}`)
    .then(() => c.waitFor(editable, 45000))
    .then(() => true)
    .catch(() => false);
  if (!opened) {
    console.log("entry: not editable after 45 s, reloading once:", await pageState(c), c.errors.slice(-3));
    entryTry = 2;
    opened = await c
      .goto(`/app/groups/${G}/entries/${noteId}`)
      .then(() => c.waitFor(editable, 45000))
      .then(() => true)
      .catch(() => false);
  }
  check(
    "an entry opens under the group route, editable for a writer",
    opened,
    opened
      ? entryTry > 1
        ? "on the second try"
        : ""
      : `${await pageState(c)} ${c.errors.slice(-3).join(" | ")}`,
  );

  await c.goto(`/app/groups/${G}/settings`);
  await c.waitFor(`document.querySelector("[data-section=members] li")`, 20000).then(
    () => check("group settings opens under the group route", true),
    async () =>
      check(
        "group settings opens under the group route",
        false,
        `${await pageState(c)} ${c.errors.slice(-3).join(" | ")}`,
      ),
  );

  // Live: a rename on the server reaches the heading without a reload.
  await c.goto(`/app/groups/${G}/timeline`);
  await c.waitFor(`document.querySelector("ol > li")`, 20000);
  await c.evaluate("window.__stay = 1");
  const renamed = `Grandma Pat ${Date.now().toString(36)}`;
  psql(`UPDATE care_recipient SET preferred_name = '${renamed}' WHERE group_id = '${G}'`);
  await c.waitFor(`${h1} === ${JSON.stringify(renamed)}`, 20000).then(
    () => check("a recipient renamed on the server shows in the heading without a reload", true),
    async () =>
      check(
        "a recipient renamed on the server shows in the heading without a reload",
        false,
        await c.evaluate(h1),
      ),
  );
  check("…and the page wasn't reloaded", (await c.evaluate("window.__stay")) === 1);
  psql(
    `UPDATE care_recipient SET preferred_name = ${foundName ? `'${foundName}'` : "NULL"} WHERE group_id = '${G}'`,
  );

  // Live: a role changed on the server takes the entry page's writer controls away.
  await c.goto(`/app/groups/${G}/entries/${noteId}`);
  await c.waitFor(`document.querySelector("[contenteditable=true]") && ${titleInput}`, 20000);
  await c.evaluate("window.__stay = 1");
  setCaretakerRole("viewer");
  await c.waitFor(`!${titleInput} && !document.querySelector("[contenteditable=true]")`, 20000).then(
    () => check("a role changed to viewer on the server makes the entry read-only without a reload", true),
    () => check("a role changed to viewer on the server makes the entry read-only without a reload", false),
  );
  check("…and the page wasn't reloaded", (await c.evaluate("window.__stay")) === 1);
  setCaretakerRole(foundRole);
  await c.waitFor(`!!${titleInput}`, 20000).then(
    () => check("the role back to caretaker brings the controls back", true),
    () => check("the role back to caretaker brings the controls back", false),
  );

  // Slice 4: the account's settings list and subpages.
  await settingsSteps(c);

  // admin@: in no care group, so every group URL is a 404 that names nothing.
  await sleep(4000); // Better Auth's sign-in rate limit.
  browsers.push(await launch(9482));
  const a = await openPage(browsers[1], "admin");
  await a.signIn("admin@example.com", PW, { home: true });
  for (const sub of ["", "/timeline", `/entries/${noteId}`, "/settings"]) {
    await a.goto(`/app/groups/${G}${sub}`);
    await a.waitFor(`${h1} === "Not found"`, 20000).catch(() => {});
    const page = JSON.parse(
      await a.evaluate(`JSON.stringify({ h1: ${h1}, leaks: ${leaks}, path: location.pathname })`),
    );
    check(
      `non-member: /app/groups/<id>${sub.replace(noteId, "<id>")} is the /app 404, with no names`,
      page.h1 === "Not found" && !page.leaks && page.path === `/app/groups/${G}${sub}`,
      JSON.stringify(page),
    );
  }
  const frame = JSON.parse(
    await a.evaluate(
      `JSON.stringify({ main: [...document.querySelectorAll("main a")].map((l) => l.getAttribute("href")) })`,
    ),
  );
  check("non-member: the 404 has a way back to /app", frame.main.includes("/app"), JSON.stringify(frame));

  const errors = [...c.errors, ...a.errors].filter(
    (e) =>
      !/vite|PowerSync|WebSocket|Error loading route module|Failed to fetch dynamically imported module|status of 40[14]/i.test(
        e,
      ),
  );
  check("no unexpected console errors", errors.length === 0, errors.slice(0, 3).join(" | ").slice(0, 500));
} catch (e) {
  console.log("ERROR", e.message);
  if (c)
    console.log(
      "caretaker page:",
      await c
        .evaluate(
          `JSON.stringify({ path: location.pathname, sync: window.caretookSync?.powersync.currentStatus.toJSON(), main: document.querySelector("main")?.innerText.slice(0, 300) })`,
        )
        .catch(() => "?"),
      c.errors.slice(0, 5),
    );
  results.push(false);
} finally {
  psql(
    `UPDATE care_recipient SET preferred_name = ${foundName ? `'${foundName}'` : "NULL"} WHERE group_id = '${G}'`,
  );
  setCaretakerRole(foundRole);
  for (const b of browsers) b.proc.kill();
  console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
  process.exit(results.every(Boolean) ? 0 : 1);
}
