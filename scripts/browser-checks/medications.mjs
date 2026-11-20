// Medications end to end, what's left of it (check-migration slice 9 moved
// the rest): the device module and the screens for the list, a medication's
// page and its notes, adding and editing, the status actions, allergies, the
// printable sheets and the provider page's region are component tests now
// (medicationWorld.tsx's world: medicationList, medicationForm, print,
// allergies, medication and providerMedications browser tests, and
// lib/sync/medications.browser.test.tsx), and an offline batch's upload is
// syncMedications.int.test.ts's. These steps are slice 11's to move:
//
// Doses and changes on the timeline (slice 4, `timelineSteps`): seeded doses
// and changes read right in rows and cards, the kind chips and icons filter
// them, the quick-add bar's order, logging a dose from the Dose sheet (on a
// second device too), editing and deleting it, an earlier time landing on
// yesterday, a change entry that deletes but never opens, offline logging,
// and a viewer with no Dose button and rows that open nothing.
//
// Slice 5 adds Today (`todaySteps`): a slot due now in Today, Given in one
// tap (seen on a second device), Skipped with a note (on the timeline too),
// the double-dose and over-maximum warnings that still save, the device in
// New York with the recipient in Los Angeles, and a viewer without controls.
// `dueDoses` itself is unit-tested (dueDoses.test.ts).
//
// Medications 2, slice 1 adds the Passes screen (`passesSteps`): the
// seeded Morning and Evening from the list's link, adding a pass (a taken
// name refused), the medications in a pass, a retime with its timeline
// entry (live on a second device), Move up, an offline rename, a viewer
// without controls, and a delete that leaves its medication the time. The
// pass rules are unit-tested (medicationPass.test.ts). Passes in a
// medication's schedule (`passScheduleSteps`) and a pass slot on Today
// (`passDueSteps`) follow the timeline's steps.
//
// Medications 2, slices 4 to 6: Given all and Undo (`givenAllSteps`), the
// timeline's medication strip (`stripSteps`: next, due and overdue with this
// run's own passes, Given all and Undo from the strip, the pass's name
// opening the Dose sheet, one line at 420, a viewer's text, no strip for a
// group without scheduled medications; `medicationStrip` is unit-tested),
// and pass logs with the pass sheet (`passLogSteps`).
//
// Every medication this run makes carries its tag and is soft-deleted at the
// end, with its entries, so it passes run after run without a reset. SMOKE=1
// runs caretaker@'s path only.
import { execSync } from "node:child_process";
import { ADD_BUTTON, launch, openPage, sleep, SMOKE } from "./cdp.mjs";
import { startProxy } from "./proxy.mjs";

const PG_CONTAINER = process.env.PG_CONTAINER ?? "caretook-postgres-1";
const PW = process.env.SEED_USER_PASSWORD ?? "caretook-dev-password";
const DEV_FAMILY = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";
const DEV_FAMILY_2 = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8d0001";
const TAG = `MV-${Date.now().toString(36)}`;

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const psql = (sql) =>
  execSync(`docker exec -i ${PG_CONTAINER} psql -U caretook -d caretook -tAq -v ON_ERROR_STOP=1`, {
    input: `${sql};`,
  })
    .toString()
    .trim();
const waitForSql = async (sql, test, ms = 20000) => {
  const end = Date.now() + ms;
  let last = "";
  while (Date.now() < end) {
    last = psql(sql);
    if (test(last)) return last;
    await sleep(300);
  }
  return last;
};

/**
 * Run `body` in the page with the local database as `db` and the device
 * module as `medications`. Bounded: a call that doesn't answer in 20 s (a
 * query held up by a lock, a page that went away) fails with a clear
 * message instead of holding the run.
 */
const DEVICE_MS = 20000;
const onDevice = (p, body) =>
  Promise.race([
    p.evaluate(`(async () => {
    const db = window.caretookSync;
    if (!db) throw new Error("window.caretookSync isn't there (dev and check builds only)");
    const { medications } = await window.caretookModules();
    ${body}
  })()`),
    sleep(DEVICE_MS).then(() => {
      throw new Error(`a device call didn't answer in ${DEVICE_MS / 1000} s: ${body.trim().slice(0, 120)}`);
    }),
  ]);
const localRows = (p, sql, params = []) =>
  onDevice(p, `return db.powersync.getAll(${JSON.stringify(sql)}, ${JSON.stringify(params)});`);

/**
 * Wait at most `ms` for `expression` on `p`. On a timeout, print one line
 * saying what didn't happen, with the page's state, and return false: the
 * step's own check then fails with its detail, and the run goes on.
 */
const need = async (p, expression, ms, what) => {
  const ok = await p.waitFor(expression, ms, { quiet: true }).then(
    () => true,
    () => false,
  );
  if (!ok) console.log(`WAIT  ${what}: not within ${ms / 1000} s\n${await p.diagnose()}`);
  return ok;
};

/**
 * Bring a page's tab to the front. A tab behind another gets no animation
 * frames and reports itself hidden, so what a person would see happen there
 * (a menu's exit, focus returning) may not; steps that tap run in front.
 */
const toFront = (p) => p.send("Page.bringToFront");

const CHANGES_SQL = (id) =>
  `SELECT count(*) FROM timeline_entry WHERE kind = 'medicationChange' AND details->>'medicationId' = '${id}'`;

// --- The list and a medication's page (helpers) -------------------------------

const LIST = `/app/groups/${DEV_FAMILY}/medications`;
const medPath = (id, group = DEV_FAMILY) => `/app/groups/${group}/medications/${id}`;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const NOTES = `document.querySelector("main .ProseMirror")`;
const onMedPage = (id) =>
  `location.pathname.endsWith("/medications/${id}") && !!${NOTES} && document.querySelector("main h1")?.textContent.length > 0`;
const medPage = (p) =>
  p.evaluate(`({
    h1: document.querySelector("main h1")?.textContent.trim(),
    badge: document.querySelector('main header [data-region="title"] .badge')?.textContent.trim() ?? null,
    details: document.querySelector('main header [data-region="details"]')?.textContent.trim() ?? null,
    stopped: document.querySelector("main [data-medication-stopped]")?.textContent.trim() ?? null,
    rows: Object.fromEntries([...document.querySelectorAll("main [data-detail]")].map((r) => [r.dataset.detail, r.querySelector("dd")?.textContent.trim()])),
    providers: [...document.querySelectorAll("main li[data-medication-provider]")].map((li) => [li.dataset.medicationProvider, li.querySelector("[data-provider-name]")?.textContent.trim(), li.querySelector("a[data-provider-name]")?.getAttribute("href") ?? null, !!li.querySelector("[data-contact-actions] a")]),
    history: [...document.querySelectorAll("main [data-medication-history] li[data-entry-id]")].map((li) => ({ id: li.dataset.entryId, kind: li.dataset.kind, text: li.querySelector("[data-entry-text]")?.textContent.trim() })),
    notes: ${NOTES}?.textContent ?? null,
    editable: ${NOTES}?.getAttribute("contenteditable"),
    readonly: ${NOTES}?.getAttribute("aria-readonly"),
    actions: !!document.querySelector('main header [data-region="actions"]'),
  })`);
const medicationId = async (p, name, group = DEV_FAMILY) =>
  (await localRows(p, "SELECT id FROM medication WHERE group_id = ? AND name = ?", [group, name]))[0]?.id;

// ---------------------------------------------------------------------------
// Doses and changes on the timeline (slice 4).
// ---------------------------------------------------------------------------

const ROWS = `[...document.querySelectorAll("main ol > li:not([data-marker])")]`;
const rowWith = (text) => `${ROWS}.find((li) => li.textContent.includes(${JSON.stringify(text)}))`;
const rowKinds = `[...new Set(${ROWS}.map((li) => li.querySelector(".sr-only")?.textContent))].join(",")`;
const SHEET = `document.querySelector("[role=dialog]")`;
const SUBMIT = `${SHEET}?.querySelector('button[type="submit"]')`;
const radio = (name, label) =>
  `${SHEET}?.querySelector('input[name="${name}"][aria-label=${JSON.stringify(label)}]')`;
const AMOUNT = `${SHEET}?.querySelector('input[name="amount"]')`;
const NOTE = `${SHEET}?.querySelector('textarea[name="note"]')`;
const CHIPS = `[...document.querySelectorAll('nav[aria-label="Show entries"] a')]`;
const PICK = `${SHEET}?.querySelector('[aria-label="Pick a date"]')`;
const GRID = `document.querySelector("[role=grid]")`;
const dayHeaderOf = (text) =>
  `(${rowWith(text)}?.closest("section")?.querySelector("h3")?.textContent.trim() ?? null)`;
const menuItems = `[...document.querySelectorAll("[role=menuitem]")].map((m) => m.textContent.trim())`;
const menuItem = (text) =>
  `[...document.querySelectorAll("[role=menuitem]")].find((m) => m.textContent.trim() === ${JSON.stringify(text)})`;
const pressKey = async (p, key, code, keyCode, text) => {
  await p.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key,
    code,
    windowsVirtualKeyCode: keyCode,
    ...(text ? { text } : {}),
  });
  await p.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: keyCode });
};

/** Open the Dose sheet from the + menu and log a dose of `label`. */
async function logDoseInSheet(p, label, { status = "given", note = "", yesterday = false } = {}) {
  await p.addToTimeline("Dose", { how: "tap" });
  await p.waitFor(radio("medicationId", label), 8000);
  await p.tap(radio("medicationId", label));
  if (status !== "given") await p.tap(`${SHEET}.querySelector('input[name="status"][value="${status}"]')`);
  if (note) await p.type(NOTE, note);
  if (yesterday) {
    // The calendar (keyboard, so a month boundary works too): open, one day back, pick.
    await p.evaluate(`${PICK}.focus()`);
    await pressKey(p, "Enter", "Enter", 13, "\r");
    await p.waitFor(`${GRID} && document.activeElement?.closest("[role=grid]")`, 10000);
    await pressKey(p, "ArrowLeft", "ArrowLeft", 37);
    await pressKey(p, "Enter", "Enter", 13, "\r");
    await p.waitFor(`!${GRID}`, 10000);
  }
  await p.press(SUBMIT);
  await p.waitFor(`!${SHEET}`, 8000);
}

async function timelineSteps(A, { B, C, proxyA } = {}) {
  // Earlier steps leave A on other pages (a medication, the 404), so go by the group.
  const timeline = `/app/groups/${DEV_FAMILY}/timeline`;
  // The second device watches the same timeline's doses (earlier steps left it on Dev Family 2).
  if (B) {
    await B.goto(`${timeline}?kind=dose`);
    await B.waitFor(`${ROWS}.length > 0`, 20000).catch(() => undefined);
  }
  const medName = `${TAG} Ibuprofen`;
  const label = `${medName} 200 mg`;

  // Seeded doses and changes read right, and the kind filters take them.
  await A.goto(`${timeline}?kind=dose`);
  await A.waitFor(
    `${ROWS}.length > 0 && ${rowKinds} === "Dose: " && document.querySelector("[data-medication]")`,
    20000,
  );
  const doses = await A.evaluate(
    `${ROWS}.map((li) => li.querySelector("[data-medication-entry]")?.textContent.trim() ?? "")`,
  );
  const link = await A.evaluate(
    `document.querySelector("main ol > li [data-medication]")?.getAttribute("href") ?? ""`,
  );
  check(
    "?kind=dose lists only doses, each named by its medication and strength: Given, Skipped, Refused",
    doses.length > 0 &&
      doses.some((t) => /^Lisinopril 10 mg: Given 1 tablet$/.test(t)) &&
      doses.some((t) => / mg: Skipped$/.test(t)) &&
      doses.every((t) => /^[^:]+: (Given|Skipped|Refused)/.test(t)),
    doses.slice(0, 4).join(" | "),
  );
  check(
    "a dose's medication links to its page",
    new RegExp(`/app/groups/${DEV_FAMILY}/medications/[0-9a-f-]{36}$`).test(link),
    link,
  );
  check(
    'the kind chips include "Doses" (current) and "Medication changes"',
    (await A.evaluate(`${CHIPS}.map((a) => a.textContent.trim()).join(",")`)).includes(
      "Doses,Medication changes",
    ) &&
      (await A.evaluate(
        `${CHIPS}.find((a) => a.getAttribute("aria-current") === "true")?.textContent.trim()`,
      )) === "Doses",
  );
  await A.press(`${CHIPS}.find((a) => a.textContent.trim() === "Medication changes")`);
  await A.waitFor(
    `location.search === "?kind=medicationChange" && ${rowKinds} === "Medication change: " && !${ROWS}.some((li) => li.querySelector("[data-medication-entry]")?.textContent.startsWith("Medication:"))`,
    8000,
  ).catch(() => undefined);
  const changes = await A.evaluate(
    `${ROWS}.map((li) => li.querySelector("[data-medication-entry]")?.textContent.trim() ?? "")`,
  );
  check(
    "?kind=medicationChange lists only changes: started, a strength change with before and after, stops with their reason",
    (await A.evaluate(rowKinds)) === "Medication change: " &&
      changes.includes("Lisinopril 10 mg: Changed strength 5 mg → 10 mg") &&
      changes.some((t) => /^Lisinopril .*: Started$/.test(t)) &&
      changes.some((t) => /^Oxybutynin.*: Discontinued: side effects$/.test(t)) &&
      changes.some((t) => /^Amoxicillin.*: Completed$/.test(t)),
    changes.slice(0, 8).join(" | "),
  );

  // Cards say the same.
  await A.press(
    `[...document.querySelectorAll('[aria-label="Layout"] button, [aria-label="Layout"] input')].find((b) => /Cards/.test(b.textContent + (b.getAttribute("aria-label") ?? "")))`,
  ).catch(() => undefined);
  await A.waitFor(`document.querySelector('ol[data-view="cards"]')`, 10000).catch(() => undefined);
  const cardText = await A.evaluate(
    `${rowWith("Changed strength 5 mg → 10 mg")}?.querySelector("[data-medication-entry]")?.textContent.trim() ?? ""`,
  );
  check(
    "cards show the same change text",
    (await A.evaluate(`!!document.querySelector('ol[data-view="cards"]')`)) &&
      cardText === "Lisinopril 10 mg: Changed strength 5 mg → 10 mg",
    cardText,
  );
  await A.press(
    `[...document.querySelectorAll('[aria-label="Layout"] button, [aria-label="Layout"] input')].find((b) => /Rows/.test(b.textContent + (b.getAttribute("aria-label") ?? "")))`,
  ).catch(() => undefined);
  await A.waitFor(`document.querySelector('ol[data-view="rows"]')`, 10000).catch(() => undefined);

  // A change opens nothing and its ⋯ menu has Delete only.
  const changeRow = rowWith("Changed strength 5 mg → 10 mg");
  const opens = await A.evaluate(
    `!!${changeRow}.querySelector('a[aria-label^="Edit "], a[aria-label^="Open "]')`,
  );
  await A.press(`${changeRow}.querySelector('button[aria-label^="Actions for"]')`);
  await A.waitFor(`${menuItems}.length > 0`, 10000);
  const items = await A.evaluate(`${menuItems}.join(",")`);
  await pressKey(A, "Escape", "Escape", 27);
  await A.waitFor(`!document.querySelector("[role=menu]")`, 3000, { quiet: true }).catch(() => undefined);
  check(
    "a medication change doesn't open, and its ⋯ menu has Delete only",
    !opens && items === "Delete",
    `opens ${opens}, menu ${items}`,
  );

  // The kind icon filters too.
  await A.goto(timeline);
  await A.waitFor(`${ROWS}.length > 0`, 20000);
  const doseIcon = `${ROWS}.find((li) => li.querySelector(".sr-only")?.textContent === "Dose: ")?.querySelector('a[aria-label="Show only doses"]')`;
  await A.waitFor(doseIcon, 8000).catch(() => undefined);
  if (await A.evaluate(`!!${doseIcon}`)) {
    await A.tap(doseIcon);
    await A.waitFor(`location.search === "?kind=dose" && ${rowKinds} === "Dose: "`, 8000).catch(
      () => undefined,
    );
  }
  check(
    'a dose\'s kind icon is "Show only doses", and filters',
    (await A.evaluate("location.search")) === "?kind=dose",
    await A.evaluate("location.search"),
  );

  // The + menu: Note, Event, Dose, Symptom, then the vital types (B-43).
  await A.press(ADD_BUTTON);
  await A.waitFor(`document.querySelector('[role="menu"]')`, 5000).catch(() => undefined);
  const tiles = await A.evaluate(`${menuItems}.join(",")`);
  await pressKey(A, "Escape", "Escape", 27);
  await A.waitFor(`!document.querySelector('[role="menu"]')`, 5000).catch(() => undefined);
  check(
    "the + menu reads Note, Event, Dose, Symptom, then the vital types",
    tiles.startsWith("Note,Event,Dose,Symptom,Blood pressure,"),
    tiles,
  );

  // A medication of this run's own, never given, so it's last among the choices.
  const created = await onDevice(
    A,
    `return medications.createMedication(db, ${JSON.stringify(DEV_FAMILY)}, {
       name: ${JSON.stringify(medName)}, strength: "200 mg", form: "tablet", dose: "2 tablets",
       schedule: { type: "asNeeded", maxPerDay: 3 },
     });`,
  );
  if (!created.ok) return check("a medication for the timeline steps", false, JSON.stringify(created));

  // Log one from the Dose sheet.
  await A.addToTimeline("Dose", { how: "tap" });
  await A.waitFor(radio("medicationId", label), 8000);
  // Due slots come first ("… · 20:00 dose"); the medications follow, most recently given first.
  const options = await A.evaluate(
    `[...${SHEET}.querySelectorAll('input[name="medicationId"]')].map((r) => r.getAttribute("aria-label")).filter((l) => !l.includes(" · "))`,
  );
  const lastGiven = psql(
    `SELECT m.name || COALESCE(' ' || m.strength, '') FROM timeline_entry e JOIN medication m ON m.id::text = e.details->>'medicationId'
     WHERE e.group_id = '${DEV_FAMILY}' AND e.kind = 'dose' AND e.deleted_at IS NULL AND e.details->>'status' = 'given' AND m.status = 'current' AND m.deleted_at IS NULL
     ORDER BY e.occurred_at DESC LIMIT 1`,
  );
  check(
    "the Dose sheet offers current medications only, the most recently given first",
    options[0] === lastGiven &&
      options.includes(label) &&
      !options.some((o) => /Oxybutynin|Amoxicillin/.test(o)),
    options.join(" | "),
  );
  const firstAmount = await A.evaluate(`${AMOUNT}.value`);
  await A.tap(radio("medicationId", label));
  await A.waitFor(`${AMOUNT}.value === "2 tablets"`, 10000).catch(() => undefined);
  check(
    "the amount starts as the chosen medication's dose, and follows the choice",
    firstAmount !== "" && (await A.evaluate(`${AMOUNT}.value`)) === "2 tablets",
    `${firstAmount} → ${await A.evaluate(`${AMOUNT}.value`)}`,
  );
  await A.type(NOTE, `${TAG} with lunch`);
  await A.press(SUBMIT);
  await A.waitFor(`!${SHEET}`, 8000).catch(() => undefined);
  const shown = await A.waitFor(rowWith(`${label}: Given 2 tablets`), 8000).then(
    () => true,
    () => false,
  );
  const noteShown = await A.evaluate(
    `${rowWith(label)}?.querySelector("[data-medication-note]")?.textContent ?? ""`,
  );
  const up = await waitForSql(
    `SELECT details->>'status' || ':' || (details->>'amount') || ':' || (details->>'note') FROM timeline_entry WHERE kind = 'dose' AND details->>'medicationId' = '${created.id}' AND deleted_at IS NULL`,
    (v) => v !== "",
  );
  check(
    "a writer logs a dose from quick add: it shows at once, with its note, and uploads",
    shown && noteShown === `${TAG} with lunch` && up === `given:2 tablets:${TAG} with lunch`,
    `${shown} "${noteShown}" ${up}`,
  );
  if (B) {
    const seen = await B.waitFor(rowWith(`${label}: Given 2 tablets`), 20000).then(
      () => true,
      () => false,
    );
    check("a second device shows the dose", seen);
  }

  // Edit it: the row opens its edit sheet, with the medication fixed.
  const doseRow = rowWith(label);
  await A.tap(`${doseRow}.querySelector('a[aria-label^="Edit "]')`);
  await A.waitFor(`${SHEET}?.querySelector("[data-dose-medication]")`, 8000).catch(() => undefined);
  const fixed = await A.evaluate(
    `${SHEET}?.querySelector("[data-dose-medication]")?.textContent.trim() ?? ""`,
  );
  const picker = await A.evaluate(`!!${SHEET}?.querySelector('input[name="medicationId"]')`);
  await A.tap(`${SHEET}.querySelector('input[name="status"][value="skipped"]')`);
  await A.press(SUBMIT);
  await A.waitFor(`!${SHEET}`, 8000).catch(() => undefined);
  const edited = await A.waitFor(rowWith(`${label}: Skipped`), 8000).then(
    () => true,
    () => false,
  );
  const editUp = await waitForSql(
    `SELECT details->>'status' FROM timeline_entry WHERE kind = 'dose' AND details->>'medicationId' = '${created.id}' AND deleted_at IS NULL`,
    (v) => v === "skipped",
  );
  check(
    "tapping the dose opens its edit sheet (the medication fixed); the edit shows and uploads",
    fixed === label && !picker && edited && editUp === "skipped",
    `"${fixed}" picker ${picker} ${editUp}`,
  );
  if (B) {
    const seen = await B.waitFor(rowWith(`${label}: Skipped`), 20000).then(
      () => true,
      () => false,
    );
    check("a second device shows the edit", seen);
  }

  // Delete it from the ⋯ menu: Edit, then Delete.
  await A.press(`${rowWith(label)}.querySelector('button[aria-label^="Actions for"]')`);
  await A.waitFor(`${menuItems}.length > 0`, 10000);
  const doseItems = await A.evaluate(`${menuItems}.join(",")`);
  await A.press(menuItem("Delete"));
  await A.waitFor(`document.querySelector("dialog[open]")`, 10000);
  await A.press(
    `[...document.querySelectorAll("dialog[open] button")].find((b) => b.textContent.trim() === "Delete")`,
  );
  const gone = await A.waitFor(`!${rowWith(label)}`, 8000).then(
    () => true,
    () => false,
  );
  const goneUp = await waitForSql(
    `SELECT count(*) FROM timeline_entry WHERE kind = 'dose' AND details->>'medicationId' = '${created.id}' AND deleted_at IS NULL`,
    (v) => v === "0",
  );
  check(
    "a dose's ⋯ menu has Edit and Delete; Delete removes it everywhere",
    doseItems === "Edit,Delete" && gone && goneUp === "0",
    `${doseItems} ${gone} ${goneUp}`,
  );

  // An earlier time lands on its day.
  await logDoseInSheet(A, label, { yesterday: true });
  await A.waitFor(rowWith(label), 8000).catch(() => undefined);
  await A.goto(`${timeline}?kind=dose`);
  await A.waitFor(rowWith(label), 20000).catch(() => undefined);
  const day = await A.evaluate(dayHeaderOf(label));
  check("a dose logged for yesterday is under Yesterday", day === "Yesterday", String(day));

  // The medication's "Started" change: deleted from its ⋯ menu, never edited.
  await A.goto(`${timeline}?kind=medicationChange`);
  const started = rowWith(`${label}: Started`);
  await A.waitFor(started, 20000).catch(() => undefined);
  const startedId = psql(
    `SELECT id FROM timeline_entry WHERE kind = 'medicationChange' AND details->>'medicationId' = '${created.id}' LIMIT 1`,
  );
  await A.goto(`${timeline}/${startedId}/edit?kind=medicationChange`);
  await A.waitFor(`location.pathname === ${JSON.stringify(timeline)} && !${SHEET}`, 10000).catch(
    () => undefined,
  );
  check(
    "a medication change's edit URL lands on the timeline (filters kept)",
    (await A.evaluate(`location.pathname + location.search`)) === `${timeline}?kind=medicationChange`,
    await A.evaluate(`location.pathname + location.search`),
  );
  await A.waitFor(started, 20000).catch(() => undefined);
  await A.press(`${started}.querySelector('button[aria-label^="Actions for"]')`);
  await A.waitFor(menuItem("Delete"), 10000);
  await A.press(menuItem("Delete"));
  await A.waitFor(`document.querySelector("dialog[open]")`, 10000);
  await A.press(
    `[...document.querySelectorAll("dialog[open] button")].find((b) => b.textContent.trim() === "Delete")`,
  );
  const changeGone = await A.waitFor(`!${started}`, 8000).then(
    () => true,
    () => false,
  );
  const changeUp = await waitForSql(
    `SELECT (deleted_at IS NOT NULL)::text FROM timeline_entry WHERE id = '${startedId}'`,
    (v) => v === "true",
  );
  const medKept = psql(`SELECT (deleted_at IS NULL)::text FROM medication WHERE id = '${created.id}'`);
  check(
    "a medication change can be deleted (the medication stays)",
    changeGone && changeUp === "true" && medKept === "true",
    `${changeGone} ${changeUp} ${medKept}`,
  );

  // Offline: log a dose, and it uploads on reconnecting.
  if (proxyA) {
    await A.goto(`${timeline}?kind=dose`);
    await A.waitFor(`${ROWS}.length > 0`, 20000);
    proxyA.setOnline(false);
    await A.waitFor(`document.body.innerText.includes("Offline")`, 20000).catch(() => undefined);
    await logDoseInSheet(A, label, { status: "refused", note: `${TAG} offline` });
    const local = await A.waitFor(rowWith(`${TAG} offline`), 8000).then(
      () => true,
      () => false,
    );
    await sleep(2000);
    const before = psql(`SELECT count(*) FROM timeline_entry WHERE details->>'note' = '${TAG} offline'`);
    proxyA.setOnline(true);
    const after = await waitForSql(
      `SELECT details->>'status' FROM timeline_entry WHERE details->>'note' = '${TAG} offline'`,
      (v) => v !== "",
      60000,
    );
    check(
      "offline, a dose is logged on the device and uploads after reconnecting",
      local && before === "0" && after === "refused",
      `${local} ${before} ${after}`,
    );
    if (B) {
      const seen = await B.waitFor(rowWith(`${TAG} offline`), 30000).then(
        () => true,
        () => false,
      );
      check("a second device gets the offline dose after reconnecting", seen);
    }
  }

  // A viewer: no Dose button, rows that open nothing, no ⋯; the sheet URL is the timeline.
  if (C) {
    const viewerTimeline = `/app/groups/${DEV_FAMILY}/timeline`;
    await C.goto(`${viewerTimeline}?kind=dose`);
    await C.waitFor(`${ROWS}.length > 0 && document.querySelector("[data-medication]")`, 20000).catch(
      () => undefined,
    );
    const state = await C.evaluate(
      `JSON.stringify({ bar: !!${ADD_BUTTON}, opens: !!document.querySelector('main ol a[aria-label^="Edit "], main ol a[aria-label^="Open "]'), menus: !!document.querySelector('main ol button[aria-label^="Actions"]'), rows: ${ROWS}.length })`,
    );
    const v = JSON.parse(state);
    await C.goto(`${viewerTimeline}/new/dose?kind=dose`);
    await C.waitFor(`location.pathname === ${JSON.stringify(viewerTimeline)}`, 10000).catch(() => undefined);
    const landed = await C.evaluate(`location.pathname + location.search`);
    check(
      "a viewer sees doses but no Dose button, no row opens a sheet, no ⋯; /new/dose is the timeline",
      v.rows > 0 &&
        !v.bar &&
        !v.opens &&
        !v.menus &&
        landed === `${viewerTimeline}?kind=dose` &&
        !(await C.evaluate(`!!${SHEET}`)),
      `${state} ${landed}`,
    );
  }
}

// ---------------------------------------------------------------------------
// The medication form, the page's dialogs and the list (helpers for the
// steps below; the form's own steps are component tests).
// ---------------------------------------------------------------------------

const FORM = `document.querySelector("[role=dialog] [data-medication-form]")`;
const formField = (name) => `${FORM}?.querySelector('[name="${name}"]')`;
const TIMES = `[...(${FORM}?.querySelectorAll('input[name="time"]') ?? [])]`;
const FORM_SUBMIT = `${FORM}?.querySelector('button[type="submit"]')`;
const OPEN_DIALOG = `document.querySelector("dialog[open]")`;
const dialogButton = (text) =>
  `[...(${OPEN_DIALOG}?.querySelectorAll("button") ?? [])].find((b) => b.textContent.trim() === ${JSON.stringify(text)})`;
/** The open dialog's button, once it can be pressed (a click on a disabled button does nothing). */
const enabledDialogButton = (text) => `${dialogButton(text)}?.disabled === false`;
/** Every name in one of the list's lists, this run's included. */
const allNames = (label) =>
  `[...document.querySelectorAll('main ul[aria-label="${label}"] [data-medication-name]')].map((n) => n.textContent.trim())`;
const historyTexts = (p) =>
  p.evaluate(
    `[...document.querySelectorAll("main [data-medication-history] li[data-entry-id] [data-entry-text]")].map((t) => t.textContent.trim())`,
  );

/** A real tap without scrolling first: a combo box's list closes when the page (or sheet) scrolls. */
async function tapInPlace(p, selector) {
  const point = await p.evaluate(`(() => { const r = ${selector}.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  for (const type of ["mousePressed", "mouseReleased"]) {
    await p.send("Input.dispatchMouseEvent", { type, ...point, button: "left", clickCount: 1 });
  }
}

/** Open the list, wait for it, and open the add sheet from its header (A). */
async function openAddSheet(p) {
  await toFront(p);
  await p.goto(LIST);
  await p.waitFor(`!!document.querySelector("main [data-add-medication]")`, 20000);
  await p.tap(`document.querySelector("main [data-add-medication]")`);
  await p.waitFor(`location.pathname.endsWith("/medications/new") && !!${FORM}`, 15000);
}

// ---------------------------------------------------------------------------
// medications-2 slice 2: passes in schedules.
// ---------------------------------------------------------------------------

const passSlot = (passId) => `${FORM}?.querySelector('[data-pass-slot="${passId}"]')`;
const passBox = (passId) => `${passSlot(passId)}?.querySelector('input[type="checkbox"]')`;
const passAmount = (passId) => `${FORM}?.querySelector('[name="passAmount:${passId}"]')`;
const TIME_AMOUNTS = `[...(${FORM}?.querySelectorAll('input[name="timeAmount"]') ?? [])]`;
/** JSON with object keys sorted, so a jsonb value (which reorders keys) compares with a literal. */
const canon = (value) =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
const seededPass = (name) =>
  psql(
    `SELECT id FROM medication_pass WHERE group_id = '${DEV_FAMILY}' AND name = '${name}' AND deleted_at IS NULL`,
  );

/**
 * A schedule by passes (caretaker@, A): tick Morning (with its own amount,
 * the dose as its placeholder) and Evening, plus a time of its own with an
 * amount; the list, the page and the printed list read it by pass. Then an
 * edit, offline: untick Evening and change Morning's amount, which the
 * history and the timeline name ("Removed from Evening; Morning amount …").
 */
async function passScheduleSteps(p, proxy) {
  await toFront(p);
  const MORNING = seededPass("Morning");
  const EVENING = seededPass("Evening");
  const name = `${TAG} Metoprolol`;
  await openAddSheet(p);
  await p.type(formField("name"), name);
  await p.type(formField("dose"), "25 mg");
  await p.tap(passBox(MORNING));
  await need(p, `!!${passAmount(MORNING)}`, 5000, "Morning's amount field");
  const placeholder = await p.evaluate(`${passAmount(MORNING)}?.placeholder ?? null`);
  await p.type(passAmount(MORNING), "50 mg");
  await p.tap(passBox(EVENING));
  await p.press(`${FORM}.querySelector("[data-add-time]")`);
  await p.waitFor(`${TIMES}.length === 1`, 5000);
  await p.type(`${TIMES}[0]`, "14:00");
  await p.type(`${TIME_AMOUNTS}[0]`, "12.5 mg");
  await p.press(FORM_SUBMIT);
  await need(
    p,
    `!${SHEET} && ${allNames("Current medications")}.includes(${JSON.stringify(name)})`,
    10000,
    "the medication with passes on the list",
  );
  const id = await medicationId(p, name);
  const stored = await waitForSql(
    `SELECT schedule::text FROM medication WHERE id = '${id}'`,
    (v) => v !== "",
  );
  const expected = {
    type: "scheduled",
    slots: [
      { passId: MORNING, amount: "50 mg" },
      { passId: EVENING },
      { time: "14:00", amount: "12.5 mg" },
    ].sort((a, b) => ((a.passId ?? "~") < (b.passId ?? "~") ? -1 : 1)),
  };
  const summary = await p.evaluate(
    `document.querySelector('main li[data-medication-id="${id}"] [data-medication-summary]')?.textContent.trim() ?? null`,
  );
  check(
    "a schedule by passes saves as pass slots (an amount for Morning, the dose as its placeholder) and a time with its amount; the list reads it by pass",
    placeholder === "25 mg" &&
      canon(JSON.parse(stored)) === canon(expected) &&
      summary === "25 mg · Morning (50 mg), Evening and 14:00 (12.5 mg)",
    `${placeholder} ${stored} ${summary}`,
  );
  if (SMOKE) return;

  // The page, and the printed list.
  await p.goto(medPath(id));
  await need(p, onMedPage(id), 20000, "the medication's page");
  const page = await medPage(p);
  await p.goto(`${LIST}/print`);
  const printed = `document.querySelector('main tr[data-print-medication="${id}"]')`;
  await need(p, `!!${printed}`, 20000, "the medication on the printed list");
  const row = await p.evaluate(`${printed}?.textContent ?? ""`);
  check(
    "the page and the printed list read the schedule by pass",
    page.rows.schedule?.startsWith("Morning (50 mg), Evening and 14:00 (12.5 mg)") &&
      row.includes("Morning (50 mg), Evening and 14:00 (12.5 mg)"),
    `${page.rows.schedule} | ${row.slice(0, 160)}`,
  );

  // Edit offline: the form starts as saved; untick Evening, change Morning's amount.
  await p.goto(medPath(id));
  await need(
    p,
    `${onMedPage(id)} && !!document.querySelector("main [data-edit-medication]")`,
    20000,
    "the page",
  );
  const errorsBefore = p.errors.length;
  proxy.setOnline(false);
  await need(p, `!window.caretookSync.powersync.currentStatus.connected`, 15000, "the device to go offline");
  await p.tap(`document.querySelector("main [data-edit-medication]")`);
  await need(p, `!!${FORM} && !!${passAmount(MORNING)}`, 10000, "the edit sheet (offline)");
  const prefilled = await p.evaluate(`({
    morning: ${passBox(MORNING)}?.checked, amount: ${passAmount(MORNING)}?.value,
    evening: ${passBox(EVENING)}?.checked, times: ${TIMES}.map((t) => t.value),
    timeAmounts: ${TIME_AMOUNTS}.map((t) => t.value),
  })`);
  await p.tap(passBox(EVENING));
  await p.type(passAmount(MORNING), "75 mg");
  await p.press(FORM_SUBMIT);
  await need(p, `!${SHEET} && location.pathname.endsWith("/medications/${id}")`, 10000, "the page (offline)");
  const line = "Removed from Evening; Morning amount 50 mg → 75 mg";
  await need(
    p,
    `(${JSON.stringify(line)}) === document.querySelector("main [data-medication-history] li[data-entry-id] [data-entry-text]")?.textContent.trim()`,
    10000,
    "the change in the history",
  );
  const history = await historyTexts(p);
  proxy.setOnline(true);
  await need(p, `window.caretookSync.powersync.currentStatus.connected`, 30000, "the device to reconnect");
  const synced = await waitForSql(
    `SELECT schedule::text FROM medication WHERE id = '${id}'`,
    (v) => v.includes("75 mg"),
    30000,
  );
  check(
    "the edit sheet starts as saved; offline, a schedule edit saves and the history names the pass and amount, then it uploads",
    prefilled.morning === true &&
      prefilled.amount === "50 mg" &&
      prefilled.evening === true &&
      same(prefilled.times, ["14:00"]) &&
      same(prefilled.timeAmounts, ["12.5 mg"]) &&
      history[0] === line &&
      canon(JSON.parse(synced)) ===
        canon({
          type: "scheduled",
          slots: [
            { passId: MORNING, amount: "75 mg" },
            { time: "14:00", amount: "12.5 mg" },
          ],
        }),
    `${JSON.stringify(prefilled)} ${JSON.stringify(history.slice(0, 2))} ${synced}`,
  );
  p.errors.splice(errorsBefore); // Offline fetch failures aren't the app's errors.

  // The timeline names the passes too.
  await p.goto(`/app/groups/${DEV_FAMILY}/timeline?kind=medicationChange`);
  const onTimeline = `[...document.querySelectorAll("main [data-medication-entry]")].some((el) => el.textContent === ${JSON.stringify(`${name}: ${line}`)})`;
  const shown = await p.waitFor(onTimeline, 15000).then(
    () => true,
    () => false,
  );
  check("the timeline's change row names the pass and the amount", shown, line);
}

// ---------------------------------------------------------------------------
// Today and Due now (slice 5)
// ---------------------------------------------------------------------------

const LA = "America/Los_Angeles";
/** The time it is now in Los Angeles, in minutes since midnight. */
const laMinutes = () => {
  const [h, m] = new Intl.DateTimeFormat("en-GB", {
    timeZone: LA,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date())
    .split(":")
    .map(Number);
  return h * 60 + m;
};
const hhmm = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const TODAY = `document.querySelector("main [data-today]")`;
const todaySlot = (key) => `${TODAY}?.querySelector('[data-slot="${key}"]')`;
const todayState = (key) =>
  `(${todaySlot(key)}?.querySelector("[data-slot-state]")?.dataset.slotState ?? null)`;
const doseCountSql = (id, time, status = "given") =>
  `SELECT count(*) FROM timeline_entry WHERE kind = 'dose' AND deleted_at IS NULL AND details->>'medicationId' = '${id}' AND details->>'status' = '${status}'${time ? ` AND details->>'scheduledFor' = '${time}'` : ""}`;
const doseCount = (id, time, status) => psql(doseCountSql(id, time, status));

/**
 * Today on the medication list, with this run's own medications: one with
 * two slots due now (a few minutes ago in Los Angeles, whatever the clock),
 * and an as-needed one with a maximum of 1. Given in one tap (on a second
 * device too), Skipped with a note (on the timeline too), the double-dose
 * and over-maximum warnings that still save, the recipient's zone with the
 * device in New York, and a viewer without controls.
 */
async function todaySteps(A, { B, C } = {}) {
  // Two distinct times, both due, today in Los Angeles (wait out the first minutes after midnight).
  if (laMinutes() < 8) await sleep((8 - laMinutes()) * 60_000 + 5000);
  const now = laMinutes();
  const [t1, t2] = [hhmm(now - 6), hhmm(now - 3)];
  const name = `${TAG} Donepezil`;
  const title = `${name} 5 mg`;
  const prnName = `${TAG} Ondansetron`;
  const made = await onDevice(
    A,
    `return [
       await medications.createMedication(db, ${JSON.stringify(DEV_FAMILY)}, {
         name: ${JSON.stringify(name)}, strength: "5 mg", form: "tablet", dose: "1 tablet",
         schedule: { type: "scheduled", times: ${JSON.stringify([t1, t2])} },
       }),
       await medications.createMedication(db, ${JSON.stringify(DEV_FAMILY)}, {
         name: ${JSON.stringify(prnName)}, strength: "4 mg", dose: "1 tablet",
         schedule: { type: "asNeeded", maxPerDay: 1 },
       }),
     ];`,
  );
  if (!made.every((r) => r.ok)) return check("medications for the Today steps", false, JSON.stringify(made));
  const [{ id }, { id: prnId }] = made;
  const k1 = `${id}@${t1}`;
  const k2 = `${id}@${t2}`;
  const timeline = `/app/groups/${DEV_FAMILY}/timeline`;

  // The device in New York: the recipient's 8:00 is still Los Angeles time.
  await A.send("Emulation.setTimezoneOverride", { timezoneId: "America/New_York" });
  await A.goto(LIST);
  const ny = await A.waitFor(`${todayState(k1)} === "due"`, 15000).then(
    () => true,
    () => false,
  );
  const note = await A.evaluate(`${TODAY}?.textContent.includes("Times are Los Angeles time") ?? false`);
  const deviceHour = await A.evaluate(`new Date().getHours()`);
  check(
    "with the device in New York, Today shows the Los Angeles slot as due, and says the times are Los Angeles time",
    ny && note && deviceHour === (Math.floor(now / 60) + 3) % 24,
    `${ny} ${note} device hour ${deviceHour}, LA ${t1}`,
  );
  await A.send("Emulation.setTimezoneOverride", { timezoneId: LA });
  await A.goto(LIST);
  await A.waitFor(`${todayState(k1)} === "due"`, 15000).catch(() => undefined);

  if (B) {
    await B.goto(LIST);
    await B.waitFor(`${todayState(k1)} === "due"`, 20000).catch(() => undefined);
  }

  // Given in one tap.
  await A.tap(`${todaySlot(k1)}.querySelector("[data-give]")`);
  const given = await A.waitFor(`${todayState(k1)} === "given"`, 8000).then(
    () => true,
    () => false,
  );
  const up = await waitForSql(
    `SELECT details->>'amount' FROM timeline_entry WHERE kind = 'dose' AND deleted_at IS NULL AND details->>'medicationId' = '${id}' AND details->>'scheduledFor' = '${t1}'`,
    (v) => v !== "",
  );
  check(
    "one tap on Given logs the slot with the medication's dose, and uploads",
    given && up === "1 tablet",
    up,
  );
  if (B) {
    const seen = await B.waitFor(`${todayState(k1)} === "given"`, 20000).then(
      () => true,
      () => false,
    );
    check("a second device's Today shows it given", seen);
  }

  // Skipped, with a note.
  await A.tap(`${todaySlot(k2)}.querySelector('[aria-label^="More for"]')`);
  await A.waitFor(menuItem("Skipped…"), 10000);
  await A.tap(menuItem("Skipped…"));
  await A.waitFor(`${OPEN_DIALOG}?.querySelector("[data-mark-note]")`, 10000);
  await A.type(`${OPEN_DIALOG}.querySelector("[data-mark-note]")`, `${TAG} asleep`);
  await A.tap(dialogButton("Mark skipped"));
  const skipped = await A.waitFor(`${todayState(k2)} === "skipped" && !${OPEN_DIALOG}`, 8000).then(
    () => true,
    () => false,
  );
  await A.goto(`${timeline}?kind=dose`);
  // Wait for its medication's name, not the moment's "Medication".
  const row = await A.waitFor(
    `${rowWith(`${TAG} asleep`)}?.textContent.includes(${JSON.stringify(`${title}: Skipped`)})`,
    15000,
  ).then(
    () => A.evaluate(`${rowWith(`${TAG} asleep`)}.textContent`),
    () => "",
  );
  check(
    "Skipped with a note shows as skipped in Today and on the timeline",
    skipped &&
      row.includes(`${title}: Skipped`) &&
      (await waitForSql(doseCountSql(id, t2, "skipped"), (v) => v === "1")) === "1",
    row.slice(0, 120),
  );

  // A second dose for a slot already given: the sheet warns, then saves.
  await A.goto(`/app/groups/${DEV_FAMILY}/timeline/new/dose?medication=${id}&slot=${t1}`);
  await A.waitFor(SUBMIT, 8000);
  await A.press(SUBMIT);
  const warned = await A.waitFor(`${SHEET}?.querySelector("[data-dose-warning]")`, 10000).then(
    () => A.evaluate(`${SHEET}.querySelector("[data-dose-warning]").textContent`),
    () => "",
  );
  const unsaved = doseCount(id, t1);
  const anyway = await A.evaluate(`${SUBMIT}.textContent.trim()`);
  await A.press(SUBMIT);
  await A.waitFor(`!${SHEET}`, 8000).catch(() => undefined);
  const twice = await waitForSql(doseCountSql(id, t1), (v) => v === "2", 10000);
  check(
    "logging a slot already given warns before saving, and saves on Log anyway",
    warned.includes("already given") && unsaved === "1" && anyway === "Log anyway" && twice === "2",
    `"${warned}" ${unsaved} "${anyway}" ${twice}`,
  );

  // As needed, up to 1 a day: the second Log asks first, then saves.
  await A.goto(LIST);
  const prnRow = `${TODAY}?.querySelector('[data-as-needed="${prnId}"]')`;
  await A.waitFor(`${prnRow}?.textContent.includes("0 of 1 today")`, 15000).catch(() => undefined);
  await A.tap(`${prnRow}.querySelector("[data-log-as-needed]")`);
  await A.waitFor(`${prnRow}?.textContent.includes("1 of 1 today")`, 8000).catch(() => undefined);
  await A.tap(`${prnRow}.querySelector("[data-log-as-needed]")`);
  const prnWarned = await A.waitFor(OPEN_DIALOG, 10000).then(
    () => A.evaluate(`${OPEN_DIALOG}.textContent`),
    () => "",
  );
  const before = await waitForSql(doseCountSql(prnId), (v) => v === "1");
  await A.tap(dialogButton("Log anyway"));
  const after = await A.waitFor(`${prnRow}?.textContent.includes("2 of 1 today")`, 8000).then(
    () => true,
    () => false,
  );
  check(
    "an as-needed dose past its maximum warns first, and saves on confirm",
    prnWarned.includes("1 of 1 already given today") && before === "1" && after,
    `"${prnWarned.slice(0, 120)}" ${before} ${after}`,
  );

  // The viewer: Today and the strip, without controls.
  if (C) {
    // A slot still due for the viewer to see: the medication's third time, now.
    const t3 = hhmm(laMinutes());
    const k3 = `${id}@${t3}`;
    const added =
      t3 !== t1 && t3 !== t2
        ? await onDevice(
            A,
            `return medications.updateMedication(db, ${JSON.stringify(id)}, { schedule: { type: "scheduled", times: ${JSON.stringify([t1, t2, t3])} } });`,
          )
        : { ok: false };
    if (added.ok) {
      await C.goto(LIST);
      const listed = await C.waitFor(`${todayState(k3)} === "due"`, 30000).then(
        () => true,
        () => false,
      );
      // A pass's expand isn't a logging control.
      const controls = await C.evaluate(
        `${TODAY}?.querySelectorAll("button:not([data-pass-expand])").length ?? -1`,
      );
      check(
        "a viewer sees Today, with no controls",
        listed && controls === 0,
        `${listed} buttons ${controls}`,
      );
    }
  }

  // This run's medications go.
  await onDevice(
    A,
    `await medications.removeMedication(db, ${JSON.stringify(id)});
     await medications.removeMedication(db, ${JSON.stringify(prnId)});`,
  );
}

// ---------------------------------------------------------------------------
// Passes (medications-2 slice 1): the Passes screen and the device module.
// ---------------------------------------------------------------------------

const PASSES = `/app/groups/${DEV_FAMILY}/medications/passes`;
const PASS_ROWS = `[...document.querySelectorAll("main [data-passes] > li")]`;
/** The screen's passes as "Name HH:MM", in order. */
const passList = (p) =>
  p.evaluate(
    `${PASS_ROWS}.map((li) => li.querySelector("[data-pass-name]").textContent + " " + li.querySelector("[data-pass-time]").dateTime)`,
  );
const passRow = (name) =>
  `${PASS_ROWS}.find((li) => li.querySelector("[data-pass-name]")?.textContent === ${JSON.stringify(name)})`;
const PASS_FORM = `document.querySelector("[role=dialog] [data-pass-form]")`;
const passField = (name) => `${PASS_FORM}?.querySelector('[name="${name}"]')`;
/** Its ⋯ menu's item, with real taps (the trigger, then the item where it is). */
async function passAction(p, name, item) {
  const button = `${passRow(name)}?.querySelector('button[aria-label=${JSON.stringify(`Actions for ${name}`)}]')`;
  await toFront(p);
  await p.waitFor(`!!${button}`, 15000);
  await p.tap(button);
  await p.waitFor(menuItem(item), 5000);
  await tapInPlace(p, menuItem(item));
}
/** Fill the open pass sheet and save it. */
async function savePassForm(p, { name, time }) {
  await p.waitFor(`!!${PASS_FORM}`, 8000);
  if (name !== undefined) await p.type(passField("name"), name);
  if (time !== undefined) await p.type(passField("time"), time);
  await p.press(`${PASS_FORM}.querySelector('button[type="submit"]')`);
}
const passSql = (name) =>
  `SELECT time || ':' || sort_order || ':' || (deleted_at IS NOT NULL)::text FROM medication_pass WHERE group_id = '${DEV_FAMILY}' AND name = '${name}' ORDER BY created_at DESC LIMIT 1`;

/**
 * The Passes screen (caretaker@, A): the seeded Morning and Evening, the
 * list header's link, adding a pass (a taken name refused), the medications
 * in it, a retime with its timeline entry (seen live on a second device),
 * reordering, an offline rename, and a delete that leaves the medication its
 * time. A viewer (C) reads the screen with no controls.
 */
async function passesSteps(p, { B, C, proxy } = {}) {
  const NOON = `${TAG} Noon`;
  await toFront(p);
  await p.goto(LIST);
  await need(p, `!!document.querySelector("main [data-passes-link]")`, 20000, "the list's Passes link");
  await p.tap(`document.querySelector("main [data-passes-link]")`);
  await need(
    p,
    `location.pathname.endsWith("/medications/passes") && ${PASS_ROWS}.length >= 2`,
    15000,
    "the Passes screen",
  );
  const seeded = await passList(p);
  check(
    "the list's Passes link opens the group's passes: Morning 08:00 then Evening 20:00",
    seeded[0] === "Morning 08:00" && seeded[1] === "Evening 20:00",
    JSON.stringify(seeded),
  );

  // Add a pass; a taken name (any case) is refused on its field.
  await p.tap(`document.querySelector("main [data-add-pass]")`);
  await savePassForm(p, { name: "morning", time: "07:00" });
  await need(
    p,
    `${passField("name")}?.getAttribute("aria-invalid") === "true"`,
    8000,
    "the taken name's error",
  );
  const taken = await p.evaluate(
    `document.getElementById(${passField("name")}.getAttribute("aria-describedby")?.split(" ").pop())?.textContent ?? null`,
  );
  check("a pass's name must be free (case ignored)", taken === "Another pass already has that name", taken);
  await savePassForm(p, { name: NOON, time: "12:00" });
  await need(p, `!${PASS_FORM} && !!${passRow(NOON)}`, 10000, "the new pass in the list");
  const added = await waitForSql(passSql(NOON), (v) => v.startsWith("12:00"));
  const listed = await passList(p);
  check(
    "a writer adds a pass: last in the list, and uploaded",
    listed.at(-1) === `${NOON} 12:00` && /^12:00:\d+:false$/.test(added),
    `${JSON.stringify(listed)} ${added}`,
  );
  if (SMOKE) return;

  // A medication in the pass (the form's pass choices come later): the screen lists it.
  const passId = psql(`SELECT id FROM medication_pass WHERE name = '${NOON}' AND deleted_at IS NULL`);
  const made = await onDevice(
    p,
    `return medications.createMedication(db, ${JSON.stringify(DEV_FAMILY)}, { name: ${JSON.stringify(`${TAG} Pass med`)}, strength: "5 mg", schedule: { type: "scheduled", slots: [{ passId: ${JSON.stringify(passId)}, amount: "2 tablets" }] } });`,
  );
  await need(
    p,
    `${passRow(NOON)}?.querySelector("[data-pass-medication]")?.textContent === ${JSON.stringify(`${TAG} Pass med 5 mg`)}`,
    10000,
    "the medication under its pass",
  );
  const inPass = await p.evaluate(
    `${passRow(NOON)}?.querySelector("[data-pass-medication]")?.textContent ?? null`,
  );
  check(
    "a pass lists the medications in it",
    made.ok && inPass === `${TAG} Pass med 5 mg`,
    `${JSON.stringify(made)} ${inPass}`,
  );

  // A second device follows along, live.
  if (B) {
    await B.goto(PASSES);
    await need(B, `!!${passRow(NOON)}`, 30000, "the new pass on the second device");
  }

  // Retime: every medication moves with it, and the timeline says so.
  await passAction(p, NOON, "Edit");
  await savePassForm(p, { time: "12:30" });
  await need(
    p,
    `!${PASS_FORM} && ${passRow(NOON)}?.querySelector("[data-pass-time]")?.dateTime === "12:30"`,
    10000,
    "the retimed pass",
  );
  const moved = await waitForSql(
    `SELECT details->>'beforeTime' || '>' || (details->>'afterTime') || ':' || (details->'medicationIds'->>0 = '${made.id}')::text FROM timeline_entry WHERE kind = 'medicationChange' AND details->>'passId' = '${passId}' AND deleted_at IS NULL`,
    (v) => v.length > 0,
  );
  check(
    "a retime uploads with one passMoved entry naming the pass's medication",
    moved === "12:00>12:30:true",
    moved,
  );
  if (B) {
    const live = await B.waitFor(
      `${passRow(NOON)}?.querySelector("[data-pass-time]")?.dateTime === "12:30"`,
      20000,
    ).then(
      () => true,
      () => false,
    );
    check("a second device sees the retime without a reload", live);
  }
  await p.goto(`/app/groups/${DEV_FAMILY}/timeline?kind=medicationChange`);
  const line = `${NOON} moved 12:00 → 12:30`;
  await need(
    p,
    `[...document.querySelectorAll("main [data-pass-moved]")].some((el) => el.textContent === ${JSON.stringify(line)})`,
    15000,
    "the passMoved row",
  );
  const shown = await p.evaluate(
    `[...document.querySelectorAll("main [data-pass-moved]")].map((el) => el.textContent).includes(${JSON.stringify(line)})`,
  );
  check("the timeline shows the move as one line, with no medication", shown, line);

  // Reorder: up, above Evening.
  await p.goto(PASSES);
  await need(p, `!!${passRow(NOON)}`, 15000, "the Passes screen again");
  await passAction(p, NOON, "Move up");
  await need(
    p,
    `${PASS_ROWS}[1]?.querySelector("[data-pass-name]")?.textContent === ${JSON.stringify(NOON)}`,
    10000,
    "the pass moved up",
  );
  const order = await passList(p);
  const sorted = await waitForSql(
    `SELECT string_agg(name, ',' ORDER BY sort_order, time) FROM medication_pass WHERE group_id = '${DEV_FAMILY}' AND deleted_at IS NULL AND (name IN ('Morning', 'Evening') OR name = '${NOON}')`,
    (v) => v === `Morning,${NOON},Evening`,
  );
  check(
    "Move up puts the pass before Evening, and uploads",
    order[1] === `${NOON} 12:30` && sorted === `Morning,${NOON},Evening`,
    `${JSON.stringify(order)} ${sorted}`,
  );

  // Offline: a rename saves on the device and uploads on reconnecting.
  const RENAMED = `${TAG} Lunch`;
  if (proxy) {
    const errorsBefore = p.errors.length;
    proxy.setOnline(false);
    await p.waitFor(`!window.caretookSync.powersync.currentStatus.connected`, 15000).catch(() => {});
    await passAction(p, NOON, "Edit");
    await savePassForm(p, { name: RENAMED });
    const offline = await p.waitFor(`!${PASS_FORM} && !!${passRow(RENAMED)}`, 10000).then(
      () => true,
      () => false,
    );
    proxy.setOnline(true);
    await p.waitFor(`window.caretookSync.powersync.currentStatus.connected`, 30000).catch(() => {});
    const uploaded = await waitForSql(
      `SELECT count(*) FROM medication_pass WHERE id = '${passId}' AND name = '${RENAMED}'`,
      (v) => v === "1",
      30000,
    );
    check(
      "offline, a rename saves on the device and uploads after",
      offline && uploaded === "1",
      `${offline} ${uploaded}`,
    );
    p.errors.splice(errorsBefore);
  }
  const name = proxy ? RENAMED : NOON;

  // A viewer reads the screen, with no controls.
  if (C) {
    await C.goto(PASSES);
    await need(C, `!!${passRow(name)}`, 30000, "the pass on the viewer's device");
    const viewer = await C.evaluate(
      `({ add: !!document.querySelector("main [data-add-pass]"), menus: document.querySelectorAll("main [data-passes] button").length, sub: document.querySelector("main header p")?.textContent ?? "" })`,
    );
    check(
      "a viewer sees the passes and their medications, with no controls",
      !viewer.add && viewer.menus === 0 && viewer.sub.includes("You can view the passes"),
      JSON.stringify(viewer),
    );
  }

  // Delete: the confirm says the medications keep the time; they do.
  await passAction(p, name, "Delete");
  await need(p, `!!${OPEN_DIALOG}`, 5000, "the delete confirm");
  const message = await p.evaluate(`${OPEN_DIALOG}?.textContent ?? ""`);
  await p.press(dialogButton("Delete"));
  await need(p, `!${passRow(name)}`, 10000, "the pass to leave the list");
  const gone = await waitForSql(
    `SELECT (deleted_at IS NOT NULL)::text FROM medication_pass WHERE id = '${passId}'`,
    (v) => v === "true",
  );
  const schedule = await waitForSql(`SELECT schedule::text FROM medication WHERE id = '${made.id}'`, (v) =>
    v.includes('"time"'),
  );
  const changes = psql(CHANGES_SQL(made.id));
  check(
    "Delete (after a confirm saying so) leaves the medication the pass's time and amount, with no change entry",
    message.includes("keep 12:30") &&
      gone === "true" &&
      JSON.stringify(JSON.parse(schedule)) ===
        JSON.stringify({ type: "scheduled", slots: [{ time: "12:30", amount: "2 tablets" }] }) &&
      changes === "1",
    `${gone} ${schedule} ${changes} ${message.slice(0, 80)}`,
  );
}

/**
 * A pass slot on Today (caretaker@, its own tab): a medication in this run's
 * pass, a few minutes back in Los Angeles (whatever the clock), shows the
 * pass's amount; Given logs the dose with the pass and that amount; moving
 * the pass's time keeps the slot given.
 */
async function passDueSteps(A) {
  if (laMinutes() < 10) await sleep((10 - laMinutes()) * 60_000 + 5000);
  const now = laMinutes();
  const [t1, t2] = [hhmm(now - 5), hhmm(now - 2)];
  const name = `${TAG} Memantine`;
  const made = await onDevice(
    A,
    `const { medicationPasses } = await window.caretookModules();
     const pass = await medicationPasses.createPass(db, ${JSON.stringify(DEV_FAMILY)}, { name: ${JSON.stringify(`${TAG} Round`)}, time: ${JSON.stringify(t1)} });
     if (!pass.ok) return [pass];
     return [pass, await medications.createMedication(db, ${JSON.stringify(DEV_FAMILY)}, {
       name: ${JSON.stringify(name)}, strength: "10 mg", dose: "1 tablet",
       schedule: { type: "scheduled", slots: [{ passId: pass.id, amount: "2 tablets" }] },
     })];`,
  );
  if (!made.every((r) => r?.ok)) return check("a pass and a medication in it", false, JSON.stringify(made));
  const [{ id: passId }, { id }] = made;
  const key = `${id}@${t1}`;
  await A.goto(LIST);
  const due = await A.waitFor(`${todayState(key)} === "due"`, 15000).then(
    () => true,
    () => false,
  );
  const shown = await A.evaluate(`${todaySlot(key)}?.textContent ?? ""`);
  if (due) {
    // The slot is inside its pass's card: expand it first.
    await A.tap(`${TODAY}.querySelector('[data-pass="pass:${passId}"] [data-pass-expand]')`);
    await A.waitFor(`!${todaySlot(key)}.closest("ul").hidden`, 5000).catch(() => undefined);
    await A.tap(`${todaySlot(key)}.querySelector("[data-give]")`);
  }
  const given = await A.waitFor(`${todayState(key)} === "given"`, 8000).then(
    () => true,
    () => false,
  );
  const logged = await waitForSql(
    `SELECT (details->>'passId') || '|' || (details->>'amount') || '|' || (details->>'scheduledFor') FROM timeline_entry WHERE kind = 'dose' AND deleted_at IS NULL AND details->>'medicationId' = '${id}'`,
    (v) => v !== "",
  );
  check(
    "a pass slot on Today shows the pass's amount; Given logs the pass with that amount",
    due && shown.includes("2 tablets") && given && logged === `${passId}|2 tablets|${t1}`,
    `${due} ${given} ${logged} ${shown.slice(0, 80)}`,
  );
  if (SMOKE) return;

  // Move the pass: the slot moves with it and stays given.
  const moved = await onDevice(
    A,
    `const { medicationPasses } = await window.caretookModules();
     return medicationPasses.updatePass(db, ${JSON.stringify(passId)}, { time: ${JSON.stringify(t2)} });`,
  );
  const kept = await A.waitFor(`${todayState(`${id}@${t2}`)} === "given" && !${todaySlot(key)}`, 10000).then(
    () => true,
    () => false,
  );
  check(
    "after the pass moves, the dose logged for it still answers its slot",
    moved.ok && kept,
    `${moved.ok}`,
  );
}

// ---------------------------------------------------------------------------
// Given all (medications-2 slice 4): passes on Today, Undo, the Dose sheet,
// Upcoming, offline and a second device.
// ---------------------------------------------------------------------------

const passCard = (passId, root = TODAY) => `${root}?.querySelector('[data-pass="pass:${passId}"]')`;
const passCardState = (passId, root = TODAY) => `(${passCard(passId, root)}?.dataset.passState ?? null)`;
const passCardSlot = (passId, key, root = TODAY) =>
  `${passCard(passId, root)}?.querySelector('[data-slot="${key}"]')`;
const passSlotState = (passId, key, root = TODAY) =>
  `(${passCardSlot(passId, key, root)}?.querySelector("[data-slot-state]")?.dataset.slotState ?? null)`;
const UNDO_LABEL = `(document.querySelector("[data-pass-undo-label]")?.textContent.trim() ?? null)`;
const passDosesSql = (ids) =>
  `SELECT coalesce(string_agg(m.name || ':' || (e.details->>'status') || ':' || coalesce(e.details->>'passLogId', '-'), ',' ORDER BY m.name), '')
     FROM timeline_entry e JOIN medication m ON m.id::text = e.details->>'medicationId'
    WHERE e.kind = 'dose' AND e.deleted_at IS NULL AND m.id::text IN (${ids.map((id) => `'${id}'`).join(", ")})`;
/** "X:given:<log>,Y:refused:<log>" → { X: ["given", log], … } */
const passDoses = (text) =>
  Object.fromEntries(
    (text || "")
      .split(",")
      .filter(Boolean)
      .map((d) => {
        const [name, status, log] = d.split(":");
        return [name.slice(TAG.length + 1), [status, log]];
      }),
  );

async function expandPass(p, passId, root = TODAY) {
  const open = await p.evaluate(
    `${passCard(passId, root)}?.querySelector("[data-pass-expand]")?.getAttribute("aria-expanded")`,
  );
  if (open !== "true") await p.tap(`${passCard(passId, root)}.querySelector("[data-pass-expand]")`);
  await p.waitFor(
    `${passCard(passId, root)}?.querySelector("[data-pass-expand]")?.getAttribute("aria-expanded") === "true"`,
    5000,
  );
}

/**
 * Given all, with this run's own passes a few minutes back in Los Angeles
 * (whatever the clock) and three medications in the first: Given all then
 * Undo (exactly its doses, back to open), one refused with a note and one
 * given on a second device (who logged it), then Given all offline for the
 * rest (one round), seen done on the second device; the Dose sheet and
 * Upcoming offering the second pass; viewers without controls.
 */
async function givenAllSteps(A, { B, C, proxy } = {}) {
  if (laMinutes() < 12) await sleep((12 - laMinutes()) * 60_000 + 5000);
  const now = laMinutes();
  const [t1, t2] = [hhmm(now - 7), hhmm(now - 4)];
  const names = ["Xa", "Yb", "Zc", "Wd"].map((n) => `${TAG} ${n}`);
  const made = await onDevice(
    A,
    `const { medicationPasses } = await window.caretookModules();
     const one = await medicationPasses.createPass(db, ${JSON.stringify(DEV_FAMILY)}, { name: ${JSON.stringify(`${TAG} Rounds`)}, time: ${JSON.stringify(t1)} });
     const two = await medicationPasses.createPass(db, ${JSON.stringify(DEV_FAMILY)}, { name: ${JSON.stringify(`${TAG} Round 2`)}, time: ${JSON.stringify(t2)} });
     if (!one.ok || !two.ok) return [one, two];
     const med = (name, passId, amount) => medications.createMedication(db, ${JSON.stringify(DEV_FAMILY)}, {
       name, strength: "5 mg", dose: "1 tablet",
       schedule: { type: "scheduled", slots: [{ passId, ...(amount && { amount }) }] },
     });
     const names = ${JSON.stringify(names)};
     return [one, two,
       await med(names[0], one.id, "2 tablets"), await med(names[1], one.id), await med(names[2], one.id),
       await med(names[3], two.id)];`,
  );
  if (!made.every((r) => r?.ok))
    return check("passes and medications for Given all", false, JSON.stringify(made));
  const [{ id: p1 }, { id: p2 }, ...meds] = made;
  const [x, y, z, w] = meds.map((m) => m.id);
  const key = (id, t = t1) => `${id}@${t}`;
  const passIds = [x, y, z];

  await A.goto(LIST);
  const due = await A.waitFor(`${passCardState(p1)} === "due"`, 15000).then(
    () => true,
    () => false,
  );
  const card = await A.evaluate(`${passCard(p1)}?.textContent ?? ""`);
  check(
    "Today groups by pass: the pass's name, its state and Given all for writers",
    due &&
      card.includes(`${TAG} Rounds`) &&
      card.includes("Due") &&
      (await A.evaluate(`!!${passCard(p1)}.querySelector("[data-given-all]")`)),
    card.slice(0, 160),
  );

  // Given all, then Undo: exactly its doses go, and the pass is open again.
  await A.tap(`${passCard(p1)}.querySelector("[data-given-all]")`);
  const done = await A.waitFor(`${passCardState(p1)} === "done"`, 8000).then(
    () => true,
    () => false,
  );
  const undoLabel = await A.waitFor(`${UNDO_LABEL} === ${JSON.stringify(`${TAG} Rounds logged`)}`, 5000).then(
    () => true,
    () => false,
  );
  const local = await localRows(
    A,
    `SELECT json_extract(details, '$.medicationId') AS m, json_extract(details, '$.passLogId') AS log, json_extract(details, '$.amount') AS amount
       FROM timeline_entry WHERE kind = 'dose' AND deleted_at IS NULL AND json_extract(details, '$.passId') = ?`,
    [p1],
  );
  const oneLog = new Set(local.map((r) => r.log)).size === 1 && !!local[0]?.log;
  const amountX = local.find((r) => r.m === x)?.amount;
  check(
    "Given all logs every open medication in the pass at once, in one round, with each slot's amount; the pass is done and Undo is offered",
    done && undoLabel && local.length === 3 && oneLog && amountX === "2 tablets",
    `${done} ${undoLabel} ${local.length} ${oneLog} ${amountX}`,
  );
  await A.tap(`document.querySelector("[data-pass-undo-button]")`);
  const reopened = await A.waitFor(
    `${passCardState(p1)} === "due" && !${passCard(p1)}.hasAttribute("data-pass-partly") && !document.querySelector("[data-pass-undo-label]")`,
    8000,
  ).then(
    () => true,
    () => false,
  );
  const live = await localRows(
    A,
    `SELECT count(*) AS n FROM timeline_entry WHERE kind = 'dose' AND deleted_at IS NULL AND json_extract(details, '$.passId') = ?`,
    [p1],
  );
  const removed = await waitForSql(
    `SELECT count(*) FILTER (WHERE deleted_at IS NULL) || '/' || count(*) FROM timeline_entry WHERE kind = 'dose' AND details->>'passId' = '${p1}'`,
    (v) => v === "0/3",
    20000,
  );
  check(
    "Undo removes exactly those doses, and the pass is open again",
    reopened && live[0]?.n === 0 && removed === "0/3",
    `${reopened} ${live[0]?.n} ${removed}`,
  );
  if (SMOKE) return cleanUp();

  // One medication refused (with a note), one given on a second device: who logged it shows.
  await expandPass(A, p1);
  await A.tap(`${passCardSlot(p1, key(y))}.querySelector('[aria-label^="More for"]')`);
  await A.waitFor(menuItem("Refused…"), 5000);
  await A.tap(menuItem("Refused…"));
  await A.waitFor(`${OPEN_DIALOG}?.querySelector("[data-mark-note]")`, 5000);
  await A.type(`${OPEN_DIALOG}.querySelector("[data-mark-note]")`, `${TAG} spat out`);
  await A.tap(dialogButton("Mark refused"));
  const refused = await A.waitFor(`${passSlotState(p1, key(y))} === "refused" && !${OPEN_DIALOG}`, 8000).then(
    () => true,
    () => false,
  );
  check("a medication in a pass can be marked refused, with a note", refused);

  if (B) {
    await toFront(B);
    await B.goto(LIST);
    // Wait for the refusal (and its round) to reach B before B joins it.
    await B.waitFor(`${passSlotState(p1, key(y))} === "refused"`, 30000).catch(() => undefined);
    await expandPass(B, p1);
    await B.tap(`${passCardSlot(p1, key(x))}.querySelector("[data-give]")`);
    await B.waitFor(`${passSlotState(p1, key(x))} === "given"`, 8000).catch(() => undefined);
    await toFront(A);
    const byB = await A.waitFor(
      `${passCardSlot(p1, key(x))}?.querySelector("[data-logged-by]")?.textContent.includes("Dev Member")`,
      30000,
    ).then(
      () => true,
      () => false,
    );
    const summary = await A.evaluate(
      `${passCard(p1)}?.querySelector("[data-pass-summary]")?.textContent ?? ""`,
    );
    check(
      "a medication given on a second device shows on Today, with who logged it",
      byB && summary.includes("Dev Member") && summary.includes("logged 2 of 3"),
      summary,
    );
  }

  // Offline: Given all logs only what's still open, in the round already started.
  if (proxy) {
    proxy.setOnline(false);
    await A.waitFor(`!window.caretookSync.powersync.currentStatus.connected`, 15000).catch(() => {});
  }
  const errorsBefore = A.errors.length;
  await A.tap(`${passCard(p1)}.querySelector("[data-given-all]")`);
  const offlineDone = await A.waitFor(`${passCardState(p1)} === "done"`, 8000).then(
    () => true,
    () => false,
  );
  if (proxy) {
    proxy.setOnline(true);
    await A.waitFor(`window.caretookSync.powersync.currentStatus.connected`, 30000).catch(() => {});
    A.errors.splice(errorsBefore);
  }
  const uploaded = passDoses(
    await waitForSql(passDosesSql(passIds), (v) => (v.match(/,/g) ?? []).length === (B ? 2 : 1), 30000),
  );
  const logs = new Set(Object.values(uploaded).map(([, log]) => log));
  check(
    `Given all${proxy ? " offline" : ""} skips what's already logged, and the pass stays one round`,
    offlineDone &&
      uploaded.Zc?.[0] === "given" &&
      uploaded.Yb?.[0] === "refused" &&
      (!B || uploaded.Xa?.[0] === "given") &&
      logs.size === 1 &&
      !logs.has("-"),
    JSON.stringify(uploaded),
  );
  if (B) {
    const seen = await B.waitFor(`${passCardState(p1)} === "done"`, 30000).then(
      () => true,
      () => false,
    );
    check("a second device shows the pass done", seen);
  }

  // Upcoming: the second pass as one row; it opens the Dose sheet on that pass.
  const upcoming = `/app/groups/${DEV_FAMILY}/upcoming`;
  const upRow = `document.querySelector('main [data-upcoming-dose="pass:${p2}"]')`;
  await A.goto(upcoming);
  const upText = await A.waitFor(`!!${upRow}`, 15000).then(
    () => A.evaluate(`${upRow}.textContent`),
    () => "",
  );
  const firstGone = await A.evaluate(`!document.querySelector('main [data-upcoming-dose="pass:${p1}"]')`);
  check(
    "Upcoming shows an open pass as one row, and a done one not at all",
    upText.includes(`${TAG} Round 2 · 1 medication`) && firstGone,
    upText.slice(0, 120),
  );
  await A.tap(`${upRow}.querySelector("a")`);
  const sheetPass = await A.waitFor(`!!${passCard(p2, SHEET)}`, 10000).then(
    () => true,
    () => false,
  );
  const repeated = await A.evaluate(
    `!!${SHEET}?.querySelector('input[name="medicationId"][value="${key(w, t2)}"]')`,
  );
  check(
    "the Dose sheet offers the due pass first, with Given all, and doesn't repeat its slots below",
    sheetPass &&
      !repeated &&
      (await A.evaluate(`!!${passCard(p2, SHEET)}.querySelector("[data-given-all]")`)),
    `${sheetPass} ${repeated}`,
  );

  // The viewer: states without controls, on Today, in Upcoming.
  if (C) {
    await toFront(C);
    await C.goto(LIST);
    const seen = await C.waitFor(`${passCardState(p2)} === "due"`, 30000).then(
      () => true,
      () => false,
    );
    const controls = await C.evaluate(
      `${passCard(p2)}?.querySelectorAll("[data-given-all], [data-give], [aria-label^='More for']").length ?? -1`,
    );
    await C.goto(upcoming);
    const row = await C.waitFor(`!!${upRow}`, 15000).then(
      () => true,
      () => false,
    );
    const links = await C.evaluate(`${upRow}?.querySelectorAll("a").length ?? -1`);
    check(
      "a viewer sees a pass's state on Today and in Upcoming, with no logging controls",
      seen && controls === 0 && row && links === 0,
      `${seen} ${controls} ${row} ${links}`,
    );
    await toFront(A);
  }

  await A.tap(`${passCard(p2, SHEET)}.querySelector("[data-given-all]")`);
  const sheetDone = await A.waitFor(
    `${passCardState(p2, SHEET)} === "done" && ${UNDO_LABEL} === ${JSON.stringify(`${TAG} Round 2 logged`)}`,
    8000,
  ).then(
    () => true,
    () => false,
  );
  const w2 = await waitForSql(doseCountSql(w, t2), (v) => v === "1", 15000);
  check(
    "Given all in the Dose sheet logs the pass and offers Undo there",
    sheetDone && w2 === "1",
    `${sheetDone} ${w2}`,
  );

  return cleanUp();

  async function cleanUp() {
    await onDevice(
      A,
      `const { medicationPasses } = await window.caretookModules();
       for (const id of ${JSON.stringify(meds.map((m) => m.id))}) await medications.removeMedication(db, id);
       for (const id of ${JSON.stringify([p1, p2])}) await medicationPasses.removePass(db, id);`,
    );
  }
}

// ---------------------------------------------------------------------------
// The medication strip (medications-2 slice 5)
// ---------------------------------------------------------------------------

const MED_STRIP = `document.querySelector("main [data-med-strip]")`;
const stripState = `(${MED_STRIP}?.dataset.stripState ?? null)`;
const stripPass = `(${MED_STRIP}?.dataset.stripPass ?? null)`;
/** "08:05" as the app shows it: "8:05". */
const clockTime = (t) => t.replace(/^0(\d:)/, "$1");

/**
 * The timeline's medication strip, with this run's own passes placed around
 * now in Los Angeles. First every slot still open today in Dev Family gets a
 * tagged dose (taken back at the end), so only this run's passes are open:
 * an overdue one (65 minutes back) takes the line over a due one (3 minutes
 * back); Given all from the strip logs it and offers Undo, and Undo brings it
 * back; then the due pass, whose name opens the Dose sheet on it; Given all
 * moves the strip to the next pass (30 minutes ahead), quiet. One line at
 * 420, a viewer's text without controls, and no strip for a group without
 * scheduled medications (Dev Family 2's, soft-deleted for a moment).
 */
async function stripSteps(A, { B, C } = {}) {
  // An overdue pass needs 65 minutes of today behind it, and the next one 30 ahead.
  if (laMinutes() < 67) await sleep((67 - laMinutes()) * 60_000 + 5000);
  const now = laMinutes();
  const ahead = now + 30 < 24 * 60;
  const [tLate, tNow, tLater] = [hhmm(now - 65), hhmm(now - 3), hhmm(Math.min(now + 30, 24 * 60 - 1))];
  const clearNote = `${TAG} strip-clear`;
  const timeline = `/app/groups/${DEV_FAMILY}/timeline`;

  // Every open slot today: answered (a tagged dose each).
  const cleared = await onDevice(
    A,
    `const { dueDoses } = await window.caretookModules();
     const rows = await dueDoses.loadDueDoses(db, ${JSON.stringify(DEV_FAMILY)});
     const open = dueDoses.toDueDoses(rows, new Date()).slots.filter((s) => !s.dose);
     for (const s of open)
       await medications.logDose(db, ${JSON.stringify(DEV_FAMILY)}, { medicationId: s.medication.id, status: "given", scheduledFor: s.time, passId: s.passId, note: ${JSON.stringify(clearNote)} });
     return open.length;`,
  );
  const made = await onDevice(
    A,
    `const { medicationPasses } = await window.caretookModules();
     const pass = (name, time) => medicationPasses.createPass(db, ${JSON.stringify(DEV_FAMILY)}, { name, time });
     const late = await pass(${JSON.stringify(`${TAG} Late`)}, ${JSON.stringify(tLate)});
     const soon = await pass(${JSON.stringify(`${TAG} Now`)}, ${JSON.stringify(tNow)});
     const later = ${ahead} ? await pass(${JSON.stringify(`${TAG} Later`)}, ${JSON.stringify(tLater)}) : { ok: true, id: null };
     if (!late.ok || !soon.ok || !later.ok) return [late, soon, later];
     const med = (name, passId) => medications.createMedication(db, ${JSON.stringify(DEV_FAMILY)}, {
       name, strength: "5 mg", dose: "1 tablet", schedule: { type: "scheduled", slots: [{ passId }] },
     });
     const meds = [await med(${JSON.stringify(`${TAG} Sa`)}, late.id), await med(${JSON.stringify(`${TAG} Sb`)}, soon.id), await med(${JSON.stringify(`${TAG} Sc`)}, soon.id)];
     if (later.id) meds.push(await med(${JSON.stringify(`${TAG} Sd`)}, later.id));
     return [late, soon, later, ...meds];`,
  );
  if (!made.every((r) => r?.ok))
    return check("passes and medications for the strip", false, JSON.stringify(made));
  const [{ id: pLate }, { id: pNow }, { id: pLater }, ...meds] = made;

  try {
    await A.goto(timeline);
    const overdue = await A.waitFor(
      `${stripState} === "overdue" && ${stripPass} === "pass:${pLate}"`,
      20000,
    ).then(
      () => true,
      () => false,
    );
    const text = await A.evaluate(`${MED_STRIP}?.textContent ?? ""`);
    const height = await A.evaluate(`${MED_STRIP}?.getBoundingClientRect().height ?? 0`);
    check(
      "the strip shows an overdue pass in the place of a due one, on one line at 420, with Given all",
      overdue &&
        text.includes(`Overdue: ${TAG} Late · ${clockTime(tLate)} · 1 med · +1 more`) &&
        height > 0 &&
        height <= 40 &&
        (await A.evaluate(`!!${MED_STRIP}.querySelector("[data-strip-given-all]")`)),
      `${overdue} cleared ${cleared} height ${height} "${text}"`,
    );

    // Given all from the strip, then Undo: the overdue pass comes back.
    await A.tap(`${MED_STRIP}.querySelector("[data-strip-given-all]")`);
    const moved = await A.waitFor(`${stripState} === "due" && ${stripPass} === "pass:${pNow}"`, 8000).then(
      () => true,
      () => false,
    );
    const undo = await A.waitFor(`${UNDO_LABEL} === ${JSON.stringify(`${TAG} Late logged`)}`, 5000).then(
      () => true,
      () => false,
    );
    const lateDoses = await waitForSql(doseCountSql(meds[0].id, tLate), (v) => v === "1", 15000);
    check(
      "Given all from the strip logs the pass, offers Undo, and the strip moves to the due pass",
      moved && undo && lateDoses === "1",
      `${moved} ${undo} ${lateDoses}`,
    );
    await A.tap(`document.querySelector("[data-pass-undo-button]")`);
    const back = await A.waitFor(
      `${stripState} === "overdue" && ${stripPass} === "pass:${pLate}"`,
      8000,
    ).then(
      () => true,
      () => false,
    );
    check("Undo from the strip takes the doses back, and the overdue pass returns", back);
    await A.tap(`${MED_STRIP}.querySelector("[data-strip-given-all]")`);
    await A.waitFor(`${stripState} === "due"`, 8000).catch(() => undefined);
    const dueText = await A.evaluate(`${MED_STRIP}?.textContent ?? ""`);
    check(
      "a due pass reads its name, its time and how many medications",
      dueText.includes(`Due: ${TAG} Now · ${clockTime(tNow)} · 2 meds`) && !dueText.includes("more"),
      dueText,
    );
    if (SMOKE) return;

    // The pass's name opens the Dose sheet on that pass.
    await A.tap(`${MED_STRIP}.querySelector("[data-strip-open]")`);
    const sheet = await A.waitFor(`!!${passCard(pNow, SHEET)}`, 10000).then(
      () => true,
      () => false,
    );
    check("the pass's name opens the Dose sheet on that pass", sheet);
    await A.goto(timeline);
    await A.waitFor(`${stripState} === "due" && !${SHEET}`, 15000).catch(() => undefined);

    // A viewer: the text, no link or button.
    if (C) {
      await toFront(C);
      await C.goto(timeline);
      const seen = await C.waitFor(`${stripState} === "due" && ${stripPass} === "pass:${pNow}"`, 30000).then(
        () => true,
        () => false,
      );
      const controls = await C.evaluate(`${MED_STRIP}?.querySelectorAll("a, button").length ?? -1`);
      const viewerHeight = await C.evaluate(`${MED_STRIP}?.getBoundingClientRect().height ?? 0`);
      check(
        "a viewer sees the strip as text, with no link or Given all, on one line",
        seen && controls === 0 && viewerHeight <= 40,
        `${seen} ${controls} ${viewerHeight}`,
      );
      await toFront(A);
    }

    // Given all for the due pass: the strip moves on to the next, quiet.
    await A.tap(`${MED_STRIP}.querySelector("[data-strip-given-all]")`);
    if (ahead) {
      const next = await A.waitFor(
        `${stripState} === "next" && ${stripPass} === "pass:${pLater}"`,
        8000,
      ).then(
        () => true,
        () => false,
      );
      const nextText = await A.evaluate(`${MED_STRIP}?.textContent ?? ""`);
      check(
        "once the due pass is logged, the strip shows the next pass, with no Given all",
        next &&
          nextText.includes(`Next: ${TAG} Later · ${clockTime(tLater)} · 1 med`) &&
          (await A.evaluate(`!${MED_STRIP}.querySelector("[data-strip-given-all]")`)),
        nextText,
      );
    } else check("(skipped: the next pass would be tomorrow) the strip's next pass", true);

    // A group without scheduled medications: no strip (Dev Family 2's, soft-deleted for a moment).
    if (B) {
      const ids = psql(
        `SELECT string_agg(id::text, ',') FROM medication WHERE group_id = '${DEV_FAMILY_2}' AND deleted_at IS NULL AND schedule->>'type' = 'scheduled'`,
      )
        .split(",")
        .filter(Boolean);
      await toFront(B);
      await B.goto(`/app/groups/${DEV_FAMILY_2}/timeline`);
      const before = await B.waitFor(`!!${MED_STRIP}`, 20000).then(
        () => true,
        () => false,
      );
      const list = ids.map((id) => `'${id}'`).join(", ");
      if (ids.length) psql(`UPDATE medication SET deleted_at = now() WHERE id IN (${list})`);
      try {
        const gone = await B.waitFor(
          `!${MED_STRIP} && !!document.querySelector("main [data-view]")`,
          30000,
        ).then(
          () => true,
          () => false,
        );
        check(
          "a group without scheduled medications shows no strip",
          ids.length > 0 && before && gone,
          `${ids.length} ${before} ${gone}`,
        );
      } finally {
        if (ids.length) psql(`UPDATE medication SET deleted_at = NULL WHERE id IN (${list})`);
      }
      await toFront(A);
    }
  } finally {
    await onDevice(
      A,
      `const { medicationPasses } = await window.caretookModules();
       for (const id of ${JSON.stringify(meds.map((m) => m.id))}) await medications.removeMedication(db, id);
       for (const id of ${JSON.stringify([pLate, pNow, pLater].filter(Boolean))}) await medicationPasses.removePass(db, id);`,
    ).catch(() => undefined);
    psql(
      `UPDATE timeline_entry SET deleted_at = now() WHERE deleted_at IS NULL AND kind = 'dose' AND details->>'note' = '${clearNote}'`,
    );
  }
}

// ---------------------------------------------------------------------------
// Pass logs on the timeline and the pass sheet (medications-2 slice 6).
// ---------------------------------------------------------------------------

const passLogRow = (log) => `document.querySelector('main [data-pass-log="${log}"]')`;
const LOG_FORM = `${SHEET}?.querySelector("[data-pass-log-form]")`;
const passDoseField = (doseId, name) => `${LOG_FORM}?.querySelector('[name="${name}:${doseId}"]')`;
const passLogSql = (log) =>
  `SELECT coalesce(string_agg(m.name || ':' || (e.details->>'status') || ':' || coalesce(e.details->>'amount', '-') || ':' || (e.deleted_at IS NULL), ',' ORDER BY m.name), '')
     FROM timeline_entry e JOIN medication m ON m.id::text = e.details->>'medicationId'
    WHERE e.kind = 'dose' AND e.details->>'passLogId' = '${log}'`;

/**
 * A round logged together (this run's own pass and medications, logged
 * through the device module a few minutes back, so no clock matters): one
 * row on the timeline that expands to each medication; the pass sheet
 * changes a status and an amount, adds a forgotten medication, and deletes
 * the whole log offline; the guard sends viewers and a deleted log to the
 * timeline.
 */
async function passLogSteps(A, { C, proxy } = {}) {
  // Names no other step's medication or pass starts with: the strip's steps log a pass "<TAG> Late"
  // earlier in the run, and a row is matched by its text containing a name.
  const names = ["Qa", "Qb", "Qc", "Qd"].map((n) => `${TAG} ${n}`);
  const passName = `${TAG} Log`;
  const made = await onDevice(
    A,
    `const { medicationPasses } = await window.caretookModules();
     const pass = await medicationPasses.createPass(db, ${JSON.stringify(DEV_FAMILY)}, { name: ${JSON.stringify(passName)}, time: "06:00" });
     if (!pass.ok) return [pass];
     const med = (name, slots) => medications.createMedication(db, ${JSON.stringify(DEV_FAMILY)}, {
       name, strength: "5 mg", dose: "1 tablet", schedule: { type: "scheduled", slots },
     });
     const names = ${JSON.stringify(names)};
     const meds = [await med(names[0], [{ passId: pass.id }]), await med(names[1], [{ passId: pass.id }]),
       await med(names[2], [{ passId: pass.id }]), await med(names[3], [{ time: "13:00" }])];
     if (!meds.every((m) => m.ok)) return [pass, ...meds];
     const log = crypto.randomUUID();
     const at = new Date(Date.now() - 3 * 60_000).toISOString();
     const dose = (m, status) => ({ medicationId: m.id, status, amount: "1 tablet", scheduledFor: "06:00", passId: pass.id, passLogId: log, occurredAt: at });
     const logged = await medications.logDoses(db, ${JSON.stringify(DEV_FAMILY)},
       [dose(meds[0], "given"), dose(meds[1], "given"), dose(meds[2], "refused")]);
     return [pass, ...meds, { ok: logged.ok, log, ids: logged.ids }];`,
  );
  if (!made.every((r) => r?.ok)) return check("a pass log to show", false, JSON.stringify(made));
  const [{ id: passId }, ...rest] = made;
  const meds = rest.slice(0, 4).map((m) => m.id);
  const { log, ids } = rest[4];
  const [, idB] = ids;
  const timeline = `/app/groups/${DEV_FAMILY}/timeline?kind=dose`;
  const rowText = () =>
    A.evaluate(`${passLogRow(log)}?.querySelector("[data-pass-log-text]")?.textContent ?? ""`);

  try {
    await A.goto(timeline);
    // Its pass's and medications' names arrive with their own live queries, a moment after the row.
    const shown = await A.waitFor(
      `${passLogRow(log)}?.querySelector("[data-pass-log-text]")?.textContent === ${JSON.stringify(`${passName}: 2 given, 1 refused`)}`,
      15000,
    ).then(
      () => true,
      () => false,
    );
    const alone = await A.evaluate(
      `${ROWS}.filter((li) => ${JSON.stringify(names.slice(0, 3))}.some((n) => li.textContent.includes(n))).length`,
    );
    check(
      "a round logged together is one row on the timeline (the dose filter shows it)",
      shown && (await rowText()) === `${passName}: 2 given, 1 refused` && alone === 1,
      `${shown} ${await rowText()} ${alone}`,
    );
    await A.tap(`${passLogRow(log)}.querySelector("[data-pass-log-toggle]")`);
    const listed = await A.waitFor(
      `!${passLogRow(log)}.querySelector("[data-pass-log-doses]").hidden && ${passLogRow(log)}.querySelectorAll("[data-pass-log-doses] li").length === 3`,
      5000,
    ).then(
      () => true,
      () => false,
    );
    const lines = await A.evaluate(
      `[...${passLogRow(log)}.querySelectorAll("[data-pass-log-doses] li")].map((li) => li.textContent).join(" | ")`,
    );
    check(
      "expanding the row lists each medication and what happened",
      listed &&
        lines.includes(`${names[2]} 5 mg: Refused`) &&
        lines.includes(`${names[0]} 5 mg: Given 1 tablet`),
      lines.slice(0, 200),
    );
    if (SMOKE) return;

    // The pass sheet: a status and an amount, saved together.
    const openSheet = async () => {
      // The row's text, not its middle: the expanded list's medication links sit above the open target.
      await A.tap(`${passLogRow(log)}.querySelector("[data-pass-log-text]")`);
      return A.waitFor(
        `location.pathname.endsWith("/timeline/pass/${log}/edit") && ${LOG_FORM}?.querySelectorAll("fieldset[data-pass-dose]").length >= 3`,
        10000,
      ).then(
        () => true,
        () => false,
      );
    };
    const opened = await openSheet();
    check("tapping the row opens the pass sheet with each dose", opened);
    await A.tap(`${LOG_FORM}.querySelector('input[name="status:${idB}"][value="skipped"]')`);
    await A.type(passDoseField(ids[0], "amount"), "3 tablets");
    await A.press(`${LOG_FORM}.querySelector('button[type="submit"]')`);
    const closed = await A.waitFor(`!${SHEET} && !location.pathname.includes("/pass/")`, 8000).then(
      () => true,
      () => false,
    );
    const saved = await waitForSql(passLogSql(log), (v) => v.includes(":skipped:"), 20000);
    check(
      "the pass sheet saves a status and an amount, and the row says so",
      closed &&
        (await rowText()) === `${passName}: 1 given, 1 skipped, 1 refused` &&
        saved.includes(`${names[0]}:given:3 tablets:true`) &&
        saved.includes(`${names[1]}:skipped:1 tablet:true`),
      `${closed} ${await rowText()} ${saved}`,
    );

    // Add a forgotten medication: a dose in the same round, at once.
    await openSheet();
    await A.evaluate(`(() => { const el = ${SHEET}.querySelector('[data-pass-log-add] select');
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(el, ${JSON.stringify(meds[3])});
      el.dispatchEvent(new Event("change", { bubbles: true })); })()`);
    await A.tap(`${SHEET}.querySelector('[data-pass-log-add] button[type="submit"]')`);
    const four = await A.waitFor(
      `${LOG_FORM}?.querySelectorAll("fieldset[data-pass-dose]").length === 4`,
      8000,
    ).then(
      () => true,
      () => false,
    );
    const added = await waitForSql(passLogSql(log), (v) => v.includes(`${names[3]}:given`), 20000);
    check(
      "Add a medication logs it in the same round, and the sheet shows it",
      four && added.includes(`${names[3]}:given:1 tablet:true`),
      `${four} ${added}`,
    );
    await A.press(`[...${SHEET}.querySelectorAll("button")].find((b) => b.textContent.trim() === "Cancel")`);
    await A.waitFor(`!${SHEET}`, 5000).catch(() => undefined);

    // The viewer: the row and its medications, no sheet.
    if (C) {
      await toFront(C);
      await C.goto(timeline);
      const seen = await C.waitFor(`!!${passLogRow(log)}`, 30000).then(
        () => true,
        () => false,
      );
      const link = await C.evaluate(`!!${passLogRow(log)}?.querySelector('a[aria-label^="Edit"]')`);
      await C.goto(`/app/groups/${DEV_FAMILY}/timeline/pass/${log}/edit?kind=dose`);
      const turned = await C.waitFor(
        `location.pathname.endsWith("/timeline") && location.search === "?kind=dose" && !${SHEET}`,
        10000,
      ).then(
        () => true,
        () => false,
      );
      check(
        "a viewer sees the pass row but no sheet; its URL is the timeline",
        seen && !link && turned,
        `${seen} ${link} ${turned}`,
      );
      await toFront(A);
    }

    // Delete this log, offline.
    await openSheet();
    if (proxy) {
      proxy.setOnline(false);
      await A.waitFor(`!window.caretookSync.powersync.currentStatus.connected`, 15000).catch(() => {});
    }
    const errorsBefore = A.errors.length;
    await A.tap(`${SHEET}.querySelector("[data-pass-log-delete]")`);
    await A.waitFor(enabledDialogButton("Delete"), 5000);
    await A.tap(dialogButton("Delete"));
    const gone = await A.waitFor(
      `!${SHEET} && !${passLogRow(log)} && !location.pathname.includes("/pass/")`,
      8000,
    ).then(
      () => true,
      () => false,
    );
    if (proxy) {
      proxy.setOnline(true);
      await A.waitFor(`window.caretookSync.powersync.currentStatus.connected`, 30000).catch(() => {});
      A.errors.splice(errorsBefore);
    }
    const deleted = await waitForSql(
      passLogSql(log),
      (v) => !v.includes(":true") && v.split(",").length === 4,
      30000,
    );
    check(
      `Delete this log${proxy ? " offline" : ""} removes every dose in it`,
      gone && !deleted.includes(":true") && deleted.split(",").length === 4,
      `${gone} ${deleted}`,
    );
    await A.goto(`/app/groups/${DEV_FAMILY}/timeline/pass/${log}/edit`);
    const back = await A.waitFor(`location.pathname.endsWith("/timeline") && !${SHEET}`, 10000).then(
      () => true,
      () => false,
    );
    check("a deleted log's sheet URL is the timeline", back);
  } finally {
    await onDevice(
      A,
      `const { medicationPasses } = await window.caretookModules();
       const logged = await db.powersync.getAll("SELECT id FROM timeline_entry WHERE json_extract(details, '$.passLogId') = ?", [${JSON.stringify(log)}]);
       await medications.removeDoses(db, logged.map((r) => r.id));
       for (const id of ${JSON.stringify(meds)}) await medications.removeMedication(db, id);
       await medicationPasses.removePass(db, ${JSON.stringify(passId)});`,
    ).catch(() => undefined);
  }
}

// One proxy for caretaker@'s browser, shared by the offline steps.
// 9435, not 9434: slot 2's offset puts 9434 on 11434, Ollama's default port.
const proxy = startProxy(9435);
const proxyA = proxy;
const bA = await launch(9431, proxy.args);
const bB = SMOKE ? null : await launch(9432);
const bC = SMOKE ? null : await launch(9433);
const pages = [];

try {
  const A = await openPage(bA, "caretaker");
  pages.push(A);
  await A.signIn("caretaker@example.com", PW);

  if (!SMOKE) {
    // member@ (B) and viewer@ (C): the second device and the viewer for the steps below.
    const B = await openPage(bB, "member");
    pages.push(B);
    await B.signIn("member@example.com", PW);
    const C = await openPage(bC, "viewer");
    pages.push(C);
    await C.signIn("viewer@example.com", PW);
  }

  if (SMOKE) await passesSteps(A);
  else await passesSteps(A, { B: pages[1], C: pages[2], proxy: proxyA });

  // Today's steps load many pages: a tab of its own (signed in through the
  // browser's cookie) keeps A under Better Auth's per-page session limit.
  const T = await openPage(bA, "caretaker-today");
  pages.push(T);
  await T.goto(LIST);
  await T.waitFor("!!window.caretookSync && !!document.querySelector('main [data-medication-list]')", 20000);
  if (SMOKE) await todaySteps(T);
  else await todaySteps(T, { B: pages[1], C: pages[2] });
  // Close the tab itself and bring A back to the front: a background tab gets no animation frames.
  await T.send("Page.close").catch(() => undefined);
  T.close();
  await A.send("Page.bringToFront");

  if (SMOKE) await timelineSteps(A);
  else await timelineSteps(A, { B: pages[1], C: pages[2], proxyA });

  // medications-2: passes in schedules. After the timeline's steps, so their
  // change entries don't push the seeded ones off its first page.
  await passScheduleSteps(A, proxy);
  await passDueSteps(A);

  // Given all (medications-2 slice 4), in a tab of its own like Today's
  // (Better Auth's per-page session limit); after the timeline's steps, so
  // its medications' change entries don't push the seeded ones off its first page.
  const G = await openPage(bA, "caretaker-given-all");
  pages.push(G);
  await G.goto(LIST);
  await G.waitFor("!!window.caretookSync && !!document.querySelector('main [data-medication-list]')", 20000);
  if (SMOKE) await givenAllSteps(G);
  else await givenAllSteps(G, { B: pages[1], C: pages[2], proxy: proxyA });
  await G.send("Page.close").catch(() => undefined);
  G.close();
  await A.send("Page.bringToFront");

  // The timeline's medication strip (medications-2 slice 5), in a tab of its
  // own too, after the timeline's steps for the same reason.
  const S = await openPage(bA, "caretaker-strip");
  pages.push(S);
  await S.goto(LIST);
  await S.waitFor("!!window.caretookSync && !!document.querySelector('main [data-medication-list]')", 20000);
  if (SMOKE) await stripSteps(S);
  else await stripSteps(S, { B: pages[1], C: pages[2] });
  await S.send("Page.close").catch(() => undefined);
  S.close();
  // Pass logs on the timeline and the pass sheet (slice 6), in a tab of its own too.
  const P = await openPage(bA, "caretaker-pass-logs");
  pages.push(P);
  await P.goto(LIST);
  await P.waitFor("!!window.caretookSync && !!document.querySelector('main [data-medication-list]')", 20000);
  if (SMOKE) await passLogSteps(P);
  else await passLogSteps(P, { C: pages[2], proxy: proxyA });
  await P.send("Page.close").catch(() => undefined);
  P.close();
  await A.send("Page.bringToFront");

  // The proxied browser's offline step: PowerSync's dropped stream and failed fetches.
  const noise =
    /401|Failed to load resource|ERR_INTERNET_DISCONNECTED|Failed to fetch|\[PowerSync\]: Sync error|\[PowerSync\]: Initial connect attempt|\[PowerSync\]: Sync aborted/;
  const errors = pages.flatMap((p) => p.errors).filter((e) => !noise.test(e));
  check("no console errors or warnings", errors.length === 0, errors.slice(0, 5).join(" | ").slice(0, 800));
} catch (e) {
  check("ran to the end", false, e.message);
} finally {
  // This run's medications and their entries, whatever happened above.
  try {
    psql(
      `UPDATE timeline_entry SET deleted_at = now() WHERE deleted_at IS NULL AND kind IN ('dose', 'medicationChange')
         AND details->>'medicationId' IN (SELECT id::text FROM medication WHERE name LIKE '${TAG}%');
       UPDATE timeline_entry SET deleted_at = now() WHERE deleted_at IS NULL AND kind = 'dose' AND details->>'note' LIKE '${TAG}%';
       UPDATE medication SET deleted_at = now() WHERE deleted_at IS NULL AND name LIKE '${TAG}%';
       UPDATE timeline_entry SET deleted_at = now() WHERE deleted_at IS NULL AND kind = 'medicationChange'
         AND details->>'passId' IN (SELECT id::text FROM medication_pass WHERE name LIKE '${TAG}%');
       UPDATE medication_pass SET deleted_at = now() WHERE deleted_at IS NULL AND name LIKE '${TAG}%';
       UPDATE provider SET deleted_at = now() WHERE deleted_at IS NULL AND name LIKE '${TAG}%'`,
    );
  } catch (e) {
    console.log(`clean-up failed: ${e.message}`);
  }
  for (const p of pages) p.close();
  for (const b of [bA, bB, bC]) b?.proc.kill();
  proxy.close?.();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
