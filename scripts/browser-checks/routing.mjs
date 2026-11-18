import { execSync } from "node:child_process";
import { launch, openPage, sleep } from "./cdp.mjs";
import { startProxy } from "./proxy.mjs";

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
// Slice 2, the add sheet's URLs (`timeline/new/symptom`, `new/vital?type=`):
//
// - Quick add → Symptom goes to `…/timeline/new/symptom?<filters>`;
// - Back, Escape, Cancel and a save each close it, keeping the scroll
//   position, the loaded ("Show older") entries and the filters, and leave
//   no sheet ahead of you in the history (Back after a save doesn't reopen it);
// - a deep link (and a reload) to `new/vital?type=heartRate` opens the sheet
//   with Heart rate; `?type=bogus` with no type; closing a deep-linked sheet
//   replaces it with the timeline;
// - `new/note` and `new/anything` land on the timeline, filters kept;
// - offline, the add links open the sheet and a save lands on the device;
// - viewer@'s sheet URL is the timeline, with no form.
//
// It runs as caretaker@ (one group), admin@ (in no group) and viewer@, puts
// back the recipient's preferred name and caretaker@'s role, and soft-deletes
// the entries it tagged, in `finally`.
//
// Slice 4, the account's settings subpages:
//
// - at 420, /app/settings is the list (Units, Timeline layout, Account); each
//   item opens its subpage, alone, with a back link to the list;
// - a subpage works as a direct link and after a reload;
// - at 1280, /app/settings opens Units beside the side nav, the current item
//   is aria-current="page", and widening the window on the list does the same;
// - Account shows the name and email, and its Sign out signs out (the last
//   caretaker@ step).
//
// Slice 3, the edit sheet's URL (`timeline/<id>/edit`):
//
// - a symptom's row tap, and its ⋯ → Edit, go to `…/timeline/<id>/edit?<filters>`
//   with the form filled; a save updates the row and closes the sheet,
//   filters kept;
// - offline, a row tap still opens the edit sheet (its module is prefetched);
// - a reload reopens the sheet with the entry's current values;
// - an entry deleted elsewhere while its sheet is open closes the sheet;
// - a note's edit URL lands on its page; a deleted entry's and another
//   group's entry's land on the timeline, filters kept;
// - viewer@'s edit URL is the timeline, with no form, and no edit targets.
//
// Slice 5, a group's settings subpages:
//
// - at 420, group settings is the list (Details, Members); each item opens its
//   subpage, alone, with a back link to the list;
// - `…/settings/members` works as a direct link and after a reload;
// - at 1280, group settings opens Details beside the side nav, and the side
//   nav opens Members with aria-current following;
// - another group's `…/settings/members` is the /app 404, with no names.
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

// The add sheet.
const T = `/app/groups/${G}/timeline`;
const tag = `RO-${Date.now().toString(36)}`;
const caretakerId = psql(`SELECT id FROM "user" WHERE email = 'caretaker@example.com'`);
const DIALOG = `document.querySelector("[role=dialog]")`;
const ROWS = `document.querySelectorAll("main ol > li").length`;
const VITAL_TYPE = `(document.querySelector('[role=dialog] input[name="vital.0.type"]')?.value ?? null)`;
const tile = (text) =>
  `[...document.querySelectorAll('[aria-label="Add to the timeline"] a, [aria-label="Add to the timeline"] button')].find((b) => b.textContent.trim() === ${JSON.stringify(text)})`;
const button = (text, scope = "document") =>
  `[...${scope}.querySelectorAll("button")].find((b) => b.textContent.trim() === ${JSON.stringify(text)})`;
const menuItem = (text) =>
  `[...document.querySelectorAll("[role=menuitem]")].find((m) => m.textContent.trim() === ${JSON.stringify(text)})`;
const where = (pg) =>
  pg
    .evaluate(
      `JSON.stringify({ path: location.pathname, search: location.search, y: Math.round(scrollY), rows: ${ROWS}, dialog: !!${DIALOG}, idx: history.state?.idx ?? null })`,
    )
    .then(JSON.parse);
const proxy = startProxy(9491);

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

/** Slice 3: the edit sheet's URL (caretaker@, a writer; ends on the timeline, online). */
async function editSheetSteps(p) {
  const name = `${tag} edit symptom`;
  const rowWith = (text) =>
    `[...document.querySelectorAll("main ol > li")].find((li) => li.textContent.includes(${JSON.stringify(text)}))`;
  const NAME_INPUT = `document.querySelector('[role=dialog] input[name="symptomName"]')`;
  const editPath = (id) => `${T}/${id}/edit`;
  const escape = async () => {
    for (const type of ["keyDown", "keyUp"])
      await p.send("Input.dispatchKeyEvent", {
        type,
        key: "Escape",
        code: "Escape",
        windowsVirtualKeyCode: 27,
      });
  };
  const closedOn = async (how, search) => {
    await p.waitFor(`!${DIALOG} && location.pathname === ${JSON.stringify(T)}`, 10000).catch(() => {});
    const at = await where(p);
    check(how, !at.dialog && at.path === T && at.search === search, JSON.stringify(at));
  };

  // A symptom of our own, added through the add sheet.
  await p.goto(T);
  await p.waitFor(`${ROWS} > 0`, 30000);
  await p.press(tile("Symptom"));
  await p.waitFor(NAME_INPUT, 10000);
  await p.type(NAME_INPUT, name);
  await p.press(`document.querySelector('[role=dialog] button[type="submit"]')`);
  await p.waitFor(`!${DIALOG} && ${rowWith(name)}`, 10000);
  const id = await p.evaluate(
    `window.caretookSync.powersync.getAll("SELECT id FROM timeline_entry WHERE json_extract(details, '$.name') = ?", [${JSON.stringify(name)}]).then((r) => r[0]?.id ?? "")`,
  );

  // A row tap, on a filtered timeline.
  const filters = "?kind=symptom";
  await p.goto(`${T}${filters}`);
  await p.waitFor(rowWith(name), 30000);
  const before = await where(p);
  await p.press(`${rowWith(name)}.querySelector('a[aria-label^="Edit "]')`);
  await p.waitFor(`${DIALOG}?.textContent.includes("Edit symptom") && ${NAME_INPUT}`, 10000).catch(() => {});
  const opened = await where(p);
  check(
    "a symptom's row tap goes to …/timeline/<id>/edit with the filters, the form filled",
    opened.path === editPath(id) &&
      opened.search === filters &&
      opened.dialog &&
      (await p.evaluate(`${NAME_INPUT}?.value`)) === name,
    JSON.stringify(opened),
  );
  const edited = `${name} edited`;
  await p.type(NAME_INPUT, edited);
  await p.press(`document.querySelector('[role=dialog] button[type="submit"]')`);
  await closedOn("a save closes the edit sheet, filters kept", filters);
  check("…and the row shows the change", await p.evaluate(`!!${rowWith(edited)}`));
  check("…and leaves no sheet ahead in the history", (await where(p)).idx === before.idx);

  // ⋯ → Edit opens the same URL.
  await p.press(`${rowWith(edited)}.querySelector('button[aria-label^="Actions"]')`);
  await p.waitFor(menuItem("Edit"), 5000);
  await p.press(menuItem("Edit"));
  await p.waitFor(`${DIALOG} && ${NAME_INPUT}`, 10000).catch(() => {});
  const viaMenu = await where(p);
  check(
    "⋯ → Edit goes to the same edit URL, the form filled",
    viaMenu.path === editPath(id) &&
      viaMenu.search === filters &&
      (await p.evaluate(`${NAME_INPUT}?.value`)) === edited,
    JSON.stringify(viaMenu),
  );
  await escape();
  await closedOn("Escape closes the edit sheet, filters kept", filters);

  // Offline, a row tap still opens the sheet (its module was prefetched).
  const errorsOnline = p.errors.length;
  proxy.setOnline(false);
  await p.waitFor(`document.body.innerText.includes("Offline")`, 20000).catch(() => {});
  await p.press(`${rowWith(edited)}.querySelector('a[aria-label^="Edit "]')`);
  await p.waitFor(`${DIALOG} && ${NAME_INPUT}?.value === ${JSON.stringify(edited)}`, 10000).then(
    () => check("offline: a row tap opens the edit sheet", true),
    async () => check("offline: a row tap opens the edit sheet", false, JSON.stringify(await where(p))),
  );
  await p.press(button("Cancel", DIALOG));
  await closedOn("offline: Cancel closes it", filters);
  proxy.setOnline(true);
  await p.waitFor(`!document.body.innerText.includes("Offline")`, 20000).catch(() => {});
  p.errors.splice(errorsOnline); // Offline fetch failures aren't the app's errors.

  // A reload shows the entry's current values: changed on the server since.
  await p.goto(`${editPath(id)}${filters}`);
  await p.waitFor(`${DIALOG} && ${NAME_INPUT}`, 30000).catch(() => {});
  const fromServer = `${name} from server`;
  psql(
    `UPDATE timeline_entry SET details = jsonb_set(details, '{name}', '"${fromServer}"'), updated_at = now() WHERE id = '${id}'`,
  );
  await p.waitFor(
    `window.caretookSync.powersync.getAll("SELECT 1 FROM timeline_entry WHERE json_extract(details, '$.name') = ?", [${JSON.stringify(fromServer)}]).then((r) => r.length === 1)`,
    20000,
  );
  // Give the local database time to persist the synced row (a reload straight
  // after a download can reopen the copy from before it).
  await sleep(3000);
  // A marker on the old page, so the wait can't be met before the reload has happened.
  await p.evaluate("window.__beforeReload = 1");
  await p.send("Page.reload", { ignoreCache: false });
  await p
    .waitFor(`!window.__beforeReload && document.readyState === "complete" && ${NAME_INPUT}`, 30000)
    .catch(() => {});
  check(
    "a reload reopens the edit sheet with the entry's current values",
    (await p.evaluate(`${NAME_INPUT}?.value`)) === fromServer,
    await p.evaluate(`${NAME_INPUT}?.value ?? "no form"`),
  );

  // Deleted on another device while open: the sheet closes onto the timeline.
  const errorsBefore = p.errors.length;
  psql(`UPDATE timeline_entry SET deleted_at = now(), updated_at = now() WHERE id = '${id}'`);
  await closedOn("an entry deleted elsewhere while its sheet is open closes the sheet", filters);
  check(
    "…with no error",
    p.errors.length === errorsBefore && !(await p.evaluate(`document.body.innerText.includes("Not found")`)),
    p.errors.slice(errorsBefore).join(" | "),
  );

  // Edit URLs that aren't a sheet.
  await p.goto(`${editPath(noteId)}${filters}`);
  await p
    .waitFor(`location.pathname === ${JSON.stringify(`/app/groups/${G}/entries/${noteId}`)}`, 30000)
    .catch(() => {});
  check(
    "a note's edit URL lands on its page",
    (await p.evaluate("location.pathname")) === `/app/groups/${G}/entries/${noteId}`,
    await p.evaluate("location.pathname"),
  );
  const otherGroupEntry = psql(`SELECT id FROM timeline_entry WHERE group_id <> '${G}' LIMIT 1`);
  for (const [what, entryId] of [
    ["a deleted entry's", id],
    ["another group's entry's", otherGroupEntry],
  ]) {
    await p.goto(`${editPath(entryId)}${filters}`);
    await p.waitFor(`location.pathname === ${JSON.stringify(T)} && ${ROWS} > 0`, 30000).catch(() => {});
    const landed = await where(p);
    check(
      `${what} edit URL lands on the timeline, filters kept`,
      landed.path === T && landed.search === filters && !landed.dialog,
      JSON.stringify(landed),
    );
  }
}

/** Slice 3: viewer@'s edit URL is the timeline, with no form and no edit targets. */
async function editSheetViewerSteps(v) {
  const symptomId = psql(
    `SELECT id FROM timeline_entry WHERE group_id = '${G}' AND kind = 'symptom' AND deleted_at IS NULL ORDER BY occurred_at DESC LIMIT 1`,
  );
  await v.goto(`${T}/${symptomId}/edit?kind=symptom`);
  await v.waitFor(`location.pathname === ${JSON.stringify(T)} && ${ROWS} > 0`, 30000).catch(() => {});
  const at = await where(v);
  check(
    "viewer: a symptom's edit URL is the timeline, with no form and no edit targets",
    at.path === T &&
      at.search === "?kind=symptom" &&
      !at.dialog &&
      (await v.evaluate(
        `!document.querySelector('input[name="symptomName"]') && !document.querySelector('main ol [aria-label^="Edit "]')`,
      )),
    JSON.stringify(at),
  );
}

/** Slice 5: a group's settings list (Details, Members), its subpages and the side nav (caretaker@, stays signed in). */
async function groupSettingsSteps(p) {
  const GS = `/app/groups/${G}/settings`;
  const ITEMS = [
    {
      id: "details",
      label: "Details",
      path: `${GS}/details`,
      ready: `document.querySelector('main [data-section="care-recipient"]')`,
    },
    {
      id: "members",
      label: "Members",
      path: `${GS}/members`,
      ready: `document.querySelector('main [data-section="members"] li[data-member]')`,
    },
  ];
  const back = `[...document.querySelectorAll("main a")].find((a) => a.getAttribute("href") === ${JSON.stringify(GS)} && a.textContent.trim() === "Group settings")`;
  const state = async () =>
    JSON.parse(
      await p.evaluate(`JSON.stringify({
        path: location.pathname,
        h1: [...document.querySelectorAll("main h1")].filter((h) => h.getClientRects().length).map((h) => h.textContent.trim()),
        items: [...(${settingsNav}?.querySelectorAll("[data-settings-item]") ?? [])].map((a) => a.querySelector("span span")?.textContent.trim()),
        navLabel: ${settingsNav}?.getAttribute("aria-label") ?? null,
        navShown: ${shown(settingsNav)},
        back: ${shown(back)},
        current: [...(${settingsNav}?.querySelectorAll("[aria-current]") ?? [])].map((a) => a.dataset.settingsItem + "=" + a.getAttribute("aria-current")),
      })`),
    );

  // 420: the list, then each subpage with a back link.
  await metrics(p, 420);
  await p.goto(GS);
  await p.waitFor(`${settingsLink("members")}`, 30000).catch(() => {});
  let s = await state();
  check(
    "420: group settings is the list of Details and Members, with no subpage and no back link",
    s.path === GS &&
      s.navShown &&
      !s.back &&
      s.h1.join() === "Group settings" &&
      s.navLabel === "Group settings" &&
      s.items.join() === ITEMS.map((i) => i.label).join(),
    JSON.stringify(s),
  );
  await p.screenshot("routing-group-settings-list-420");
  for (const item of ITEMS) {
    await p.evaluate(`${settingsLink(item.id)}.click()`);
    await p
      .waitFor(`location.pathname === ${JSON.stringify(item.path)} && ${item.ready}`, 30000)
      .catch(() => {});
    s = await state();
    check(
      `420: ${item.label} opens …/settings/${item.id} on its own, with a back link to the list`,
      s.path === item.path && s.h1.join() === item.label && s.back && !s.navShown,
      JSON.stringify(s),
    );
    await p.evaluate(`${back}.click()`);
    await p.waitFor(`location.pathname === ${JSON.stringify(GS)} && ${shown(settingsNav)}`, 10000).then(
      () => check(`420: ${item.label}'s back link returns to the group's list`, true),
      async () =>
        check(
          `420: ${item.label}'s back link returns to the group's list`,
          false,
          JSON.stringify(await state()),
        ),
    );
  }

  // A direct link, and a reload.
  const [, members] = ITEMS;
  const membersReady = `location.pathname === ${JSON.stringify(members.path)} && ${members.ready}`;
  await p.goto(members.path);
  const direct = await p.waitFor(membersReady, 30000).then(
    () => true,
    () => false,
  );
  check("…/settings/members works as a direct link", direct, direct ? "" : JSON.stringify(await state()));
  await p.evaluate("location.reload()");
  await sleep(500);
  const reloaded = await p.waitFor(membersReady, 30000).then(
    () => true,
    () => false,
  );
  check("…/settings/members works after a reload", reloaded, reloaded ? "" : JSON.stringify(await state()));

  // 1280: the side nav beside Details.
  await metrics(p, 1280);
  await p.goto(GS);
  await p
    .waitFor(`location.pathname === ${JSON.stringify(ITEMS[0].path)} && ${ITEMS[0].ready}`, 30000)
    .catch(() => {});
  s = await state();
  check(
    "1280: group settings lands on Details beside the side nav, Details current, no back link",
    s.path === ITEMS[0].path &&
      s.navShown &&
      !s.back &&
      s.h1.join() === "Details" &&
      s.current.join() === "details=page",
    JSON.stringify(s),
  );
  await p.screenshot("routing-group-settings-1280");
  await p.evaluate(`${settingsLink("members")}.click()`);
  await p.waitFor(membersReady, 20000).catch(() => {});
  s = await state();
  check(
    "1280: the side nav opens Members in one click, and aria-current follows",
    s.path === members.path && s.navShown && s.current.join() === "members=page",
    JSON.stringify(s),
  );

  // Another group's settings subpage (caretaker@ is only in Dev Family): the 404, with no names.
  await metrics(p, 420);
  const other = "/app/groups/0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8d0001/settings/members";
  await p.goto(other);
  await p.waitFor(`${h1} === "Not found"`, 30000).catch(() => {});
  const stranger = JSON.parse(
    await p.evaluate(
      `JSON.stringify({ h1: ${h1}, path: location.pathname, leaks: /Lou|Dev Family 2|Dev Member/.test(document.querySelector("main")?.innerText ?? "") })`,
    ),
  );
  check(
    "non-member: another group's …/settings/members is the /app 404, with no names",
    stranger.h1 === "Not found" && !stranger.leaks && stranger.path === other,
    JSON.stringify(stranger),
  );
}

const browsers = [];
const errorsFrom = [];
let c;
try {
  // caretaker@: a writer in Dev Family.
  browsers.push(await launch(9481, proxy.args));
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

  await c.goto(`/app/groups/${G}/settings/members`);
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

  // ── The add sheet (slice 2) ──
  // A filtered timeline with an older page loaded, scrolled down.
  const filters = `?kind=vital&author=${caretakerId}`;
  await c.goto(`${T}${filters}`);
  await c.waitFor(`${ROWS} > 0 && ${button("Show older entries")}`, 30000);
  await c.press(button("Show older entries"));
  await c.waitFor(`${ROWS} > 30`, 10000);
  await c.evaluate(`scrollTo(0, 1500)`);
  await sleep(500);
  const before = await where(c);
  check(
    "sheet setup: an older page is loaded and the timeline is scrolled",
    before.rows > 30 && before.y > 1000,
    JSON.stringify(before),
  );

  const openSymptom = async () => {
    await c.press(tile("Symptom"));
    await c.waitFor(`${DIALOG} && document.querySelector('[role=dialog] input[name="symptomName"]')`, 10000);
  };
  const sameTimeline = async (how) => {
    await c.waitFor(`!${DIALOG} && location.pathname === ${JSON.stringify(T)}`, 10000).catch(() => {});
    await sleep(300);
    const after = await where(c);
    check(
      `${how} closes the sheet, keeping the scroll position, the loaded entries and the filters`,
      !after.dialog &&
        after.path === T &&
        after.search === before.search &&
        Math.abs(after.y - before.y) <= 2 &&
        after.rows === before.rows,
      JSON.stringify({ before, after }),
    );
    check(
      `…and ${how} leaves no sheet ahead in the history`,
      after.idx === before.idx,
      JSON.stringify(after),
    );
  };

  await openSymptom();
  const sheetOpen = await where(c);
  check(
    "Quick add → Symptom goes to …/timeline/new/symptom with the filters",
    sheetOpen.path === `${T}/new/symptom` && sheetOpen.search === filters && sheetOpen.dialog,
    JSON.stringify(sheetOpen),
  );
  await c.evaluate("history.back()");
  await sameTimeline("Back");

  await openSymptom();
  await c.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  await c.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  await sameTimeline("Escape");

  await openSymptom();
  await c.press(button("Cancel", DIALOG));
  await sameTimeline("Cancel");

  const saved = `${tag} sheet symptom`;
  await openSymptom();
  await c.type(`document.querySelector('[role=dialog] input[name="symptomName"]')`, saved);
  await c.press(`document.querySelector('[role=dialog] button[type="submit"]')`);
  await sameTimeline("a save");
  check(
    "the saved symptom is on the device",
    (await c.evaluate(
      `window.caretookSync.powersync.getAll("SELECT id FROM timeline_entry WHERE json_extract(details, '$.name') = ?", [${JSON.stringify(saved)}]).then((r) => r.length)`,
    )) === 1,
  );
  await c.evaluate("history.back()");
  await sleep(2000);
  const back = await c.evaluate(`JSON.stringify({ path: location.pathname, dialog: !!${DIALOG} })`);
  check(
    "Back after a save doesn't reopen the sheet",
    !JSON.parse(back).dialog && !JSON.parse(back).path.includes("/new/"),
    back,
  );

  // A deep link with a vital type, then a reload.
  await c.goto(`${T}/new/vital?kind=vital&type=heartRate`);
  await c.waitFor(DIALOG, 30000).catch(() => {});
  check(
    "a deep link to new/vital?type=heartRate opens the sheet with Heart rate",
    (await c.evaluate(VITAL_TYPE)) === "heartRate",
  );
  await c.send("Page.reload", { ignoreCache: false });
  await sleep(500);
  await c.waitFor(`document.readyState === "complete" && ${DIALOG}`, 30000).catch(() => {});
  check("…and so does a reload", (await c.evaluate(VITAL_TYPE)) === "heartRate");
  const deep = await where(c);
  await c.press(button("Cancel", DIALOG));
  await c.waitFor(`!${DIALOG} && location.pathname === ${JSON.stringify(T)}`, 10000).catch(() => {});
  const deepClosed = await where(c);
  check(
    "closing a deep-linked sheet replaces it with the timeline, filters kept",
    !deepClosed.dialog &&
      deepClosed.path === T &&
      deepClosed.search === "?kind=vital" &&
      deepClosed.idx === deep.idx,
    JSON.stringify({ deep, deepClosed }),
  );

  await c.goto(`${T}/new/vital?type=bogus`);
  await c.waitFor(DIALOG, 30000).catch(() => {});
  check(
    "new/vital?type=bogus opens the sheet with no type chosen",
    (await c.evaluate(`!!${DIALOG} && ${VITAL_TYPE} === null`)) === true,
  );

  for (const kind of ["note", "anything"]) {
    await c.goto(`${T}/new/${kind}?kind=vital`);
    await c
      .waitFor(
        `location.pathname === ${JSON.stringify(T)} && location.search === "?kind=vital" && ${ROWS} > 0`,
        30000,
      )
      .catch(() => {});
    const landed = await where(c);
    check(
      `new/${kind} lands on the timeline, filters kept`,
      landed.path === T && landed.search === "?kind=vital" && !landed.dialog,
      JSON.stringify(landed),
    );
  }

  // Offline: the add links open the sheet, and a save lands on the device.
  await c.goto(T);
  await c.waitFor(`${ROWS} > 0`, 30000);
  const errorsOnline = c.errors.length;
  proxy.setOnline(false);
  await c.waitFor(`document.body.innerText.includes("Offline")`, 20000).catch(() => {});
  const offName = `${tag} offline symptom`;
  await openSymptom().then(
    () => check("offline: Quick add → Symptom opens the sheet", true),
    () => check("offline: Quick add → Symptom opens the sheet", false),
  );
  await c.type(`document.querySelector('[role=dialog] input[name="symptomName"]')`, offName);
  await c.press(`document.querySelector('[role=dialog] button[type="submit"]')`);
  await c
    .waitFor(
      `!${DIALOG} && [...document.querySelectorAll("main ol > li")].some((li) => li.textContent.includes(${JSON.stringify(offName)}))`,
      10000,
    )
    .then(
      () => check("offline: a save closes the sheet and shows the entry", true),
      () => check("offline: a save closes the sheet and shows the entry", false),
    );
  check(
    "offline: not on the server yet",
    psql(`SELECT count(*) FROM timeline_entry WHERE details->>'name' = '${offName}'`) === "0",
  );
  await c.press(tile("Vitals"));
  await c.waitFor(menuItem("Heart rate"), 5000);
  await c.press(menuItem("Heart rate"));
  await c.waitFor(DIALOG, 10000).catch(() => {});
  check(
    "offline: Vitals → Heart rate opens new/vital?type=heartRate with Heart rate",
    (await c.evaluate(
      `location.pathname.endsWith("/new/vital") && location.search === "?type=heartRate" && ${VITAL_TYPE} === "heartRate"`,
    )) === true,
  );
  await c.press(button("Cancel", DIALOG));
  await c.waitFor(`!${DIALOG}`, 10000).catch(() => {});
  proxy.setOnline(true);
  let uploaded = "0";
  for (let i = 0; i < 60 && uploaded === "0"; i++) {
    await sleep(1000);
    uploaded = psql(`SELECT count(*) FROM timeline_entry WHERE details->>'name' = '${offName}'`);
  }
  check("online again: the offline entry reaches the server", uploaded === "1");
  c.errors.splice(errorsOnline); // Offline fetch failures aren't the app's errors.

  // Slice 3: the edit sheet's URL.
  await editSheetSteps(c);

  // Slice 5: a group's settings list and subpages.
  await groupSettingsSteps(c);

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

  // viewer@: a sheet URL is the timeline, with no form.
  await sleep(4000); // Better Auth's sign-in rate limit.
  browsers.push(await launch(9483));
  const v = await openPage(browsers[2], "viewer");
  await v.signIn("viewer@example.com", PW);
  await v.goto(`${T}/new/symptom?kind=vital`);
  await v.waitFor(`location.pathname === ${JSON.stringify(T)} && ${ROWS} > 0`, 30000).catch(() => {});
  const viewer = await where(v);
  check(
    "viewer: new/symptom is the timeline, with no form",
    viewer.path === T &&
      viewer.search === "?kind=vital" &&
      !viewer.dialog &&
      (await v.evaluate(
        `!document.querySelector('input[name="symptomName"], form[method="post"] [name="units"]')`,
      )),
    JSON.stringify(viewer),
  );
  await editSheetViewerSteps(v);
  errorsFrom.push(v);

  const errors = [...c.errors, ...a.errors, ...errorsFrom.flatMap((p) => p.errors)].filter(
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
  psql(
    `UPDATE timeline_entry SET deleted_at = now() WHERE details->>'name' LIKE '${tag}%' AND deleted_at IS NULL`,
  );
  for (const b of browsers) b.proc.kill();
  proxy.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
  process.exit(results.every(Boolean) ? 0 : 1);
}
