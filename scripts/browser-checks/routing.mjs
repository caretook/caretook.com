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
