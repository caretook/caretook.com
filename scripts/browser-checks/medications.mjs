// Medications on devices (medications slice 1, the data layer). There are no
// medication screens yet, so every step drives the device module itself
// (lib/sync/medications.ts, through `window.caretookModules()`) against
// `window.caretookSync`:
//
// - the seeded medications, doses, change entries and medication notes reach
//   a signed-in device, with the recipient's time zone and date of birth;
// - each group's medications reach only its members;
// - a writer's local add, dose change, discontinue and restart each upload
//   with exactly one change entry, the one the device wrote (same id);
// - a refill edit writes none; a dose is logged, edited and deleted;
// - a viewer's device writes are refused locally.
//
// Doses and changes on the timeline (slice 4, `timelineSteps`): seeded doses
// and changes read right in rows and cards, the kind chips and icons filter
// them, the quick-add bar's order, logging a dose from the Dose sheet (on a
// second device too), editing and deleting it, an earlier time landing on
// yesterday, a change entry that deletes but never opens, offline logging,
// and a viewer with no Dose button and rows that open nothing.
//
// Slice 2 adds the screens:
//
// - the Medications tab (420) and header link (1280), after Providers, with
//   `aria-current` on the right one;
// - the list: four current medications first, then the completed and
//   discontinued ones with how and when they stopped; search (`?q=`) and the
//   status filter (`?status=`) survive a reload;
// - a medication's page: its details, the prescriber and pharmacy as links
//   to their pages, refills, and its doses and changes newest first;
// - its live notes: the first keystroke makes its document (subject
//   medication), and two browsers converge; a viewer reads them read-only;
// - offline, the list and the page open from the device's copy;
// - a deleted medication's, another group's and a non-member's URL is the
//   404 with no names.
//
// Slice 6 adds the printable sheet and the provider page's medications:
//
// - the list's Print link opens the sheet: the recipient's name, date of
//   birth, group and day printed; the seeded current medications by name
//   with their prescriber; the completed antibiotic and the discontinued one
//   with its reason; the prescriber's and pharmacy's first phones;
// - Print calls window.print(); in print media (420 and 1280, screenshots)
//   there's no header, tab bar or button, the tables fit the page, and it's
//   black on white in the dark theme too; it opens offline;
// - a prescriber's and the pharmacy's pages list the current medications
//   they prescribe or fill, each opening its page.
//
// Schedule wording and the list's order and matching are unit-tested
// (medicationDisplay.test.ts, medicationList.test.ts): the steps here check
// one case each, on the page. Later slices add their screens' steps here.
// Every medication this run makes carries its tag and is soft-deleted at the
// end, with its entries, so it passes run after run without a reset. SMOKE=1
// runs caretaker@'s path only: the device's seeds, the tab, the list and a
// medication's page.
import { execSync } from "node:child_process";
import { launch, openPage, sleep, SMOKE } from "./cdp.mjs";
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

/** Run `body` in the page with the local database as `db` and the device module as `medications`. */
const onDevice = (p, body) =>
  p.evaluate(`(async () => {
    const db = window.caretookSync;
    if (!db) throw new Error("window.caretookSync isn't there (dev and check builds only)");
    const { medications } = await window.caretookModules();
    ${body}
  })()`);
const localRows = (p, sql, params = []) =>
  onDevice(p, `return db.powersync.getAll(${JSON.stringify(sql)}, ${JSON.stringify(params)});`);
const waitForLocal = async (p, sql, params, test, ms = 20000) => {
  const end = Date.now() + ms;
  let rows = [];
  while (Date.now() < end) {
    rows = await localRows(p, sql, params);
    if (test(rows)) return rows;
    await sleep(300);
  }
  return rows;
};

const CHANGES_SQL = (id) =>
  `SELECT count(*) FROM timeline_entry WHERE kind = 'medicationChange' AND details->>'medicationId' = '${id}'`;

async function seedSteps(p) {
  const meds = await waitForLocal(
    p,
    "SELECT name, status FROM medication WHERE group_id = ? AND deleted_at IS NULL AND name NOT LIKE 'MV-%'",
    [DEV_FAMILY],
    (rows) => rows.length >= 6,
  );
  const names = (status) =>
    meds
      .filter((m) => m.status === status)
      .map((m) => m.name)
      .sort()
      .join(",");
  check(
    "the device has Dev Family's seeded medications: four current, one completed, one discontinued",
    names("current") === "Acetaminophen,Latanoprost,Lisinopril,Metformin" &&
      names("completed") === "Amoxicillin" &&
      names("discontinued") === "Oxybutynin",
    JSON.stringify(meds),
  );

  const listed = await onDevice(
    p,
    `const q = medications.medicationsQuery(${JSON.stringify(DEV_FAMILY)});
     return medications.toMedications(await db.powersync.getAll(q.sql, q.params))
       .filter((m) => !m.name.startsWith("MV-")).map((m) => m.name + ":" + m.schedule.type);`,
  );
  check(
    "the list query gives current ones first, then the rest, each by name, with parsed schedules",
    listed.join(",") ===
      "Acetaminophen:asNeeded,Latanoprost:scheduled,Lisinopril:scheduled,Metformin:scheduled,Amoxicillin:scheduled,Oxybutynin:scheduled",
    listed.join(","),
  );
  const found = await onDevice(
    p,
    `const q = medications.medicationsQuery(${JSON.stringify(DEV_FAMILY)}, { q: "blood", status: "current" });
     return (await db.powersync.getAll(q.sql, q.params)).map((m) => m.name);`,
  );
  check(
    'searching "blood" among current ones finds the blood pressure tablet',
    found.join(",") === "Lisinopril",
    found.join(","),
  );

  const [counts] = await waitForLocal(
    p,
    `SELECT SUM(kind = 'dose') AS doses, SUM(kind = 'medicationChange') AS changes,
            SUM(kind = 'dose' AND json_extract(details, '$.status') = 'skipped') AS skipped,
            SUM(kind = 'dose' AND json_extract(details, '$.status') = 'refused') AS refused
     FROM timeline_entry e WHERE group_id = ? AND deleted_at IS NULL
       AND json_extract(details, '$.medicationId') IN (SELECT id FROM medication WHERE name NOT LIKE 'MV-%')`,
    [DEV_FAMILY],
    (rows) => rows[0]?.doses >= 25 && rows[0]?.changes >= 10,
  );
  check(
    "the device has about a week of doses (a few skipped, one refused) and the change entries",
    counts?.doses >= 25 && counts?.changes === 10 && counts?.skipped >= 3 && counts?.refused === 1,
    JSON.stringify(counts),
  );

  const history = await onDevice(
    p,
    `const [med] = await db.powersync.getAll("SELECT id FROM medication WHERE group_id = ? AND name = 'Lisinopril'", [${JSON.stringify(DEV_FAMILY)}]);
     const q = medications.medicationEntriesQuery(med.id, "medicationChange");
     return medications.toMedicationEntries(await db.powersync.getAll(q.sql, q.params))
       .map((e) => e.details.change + ":" + (e.details.after?.strength ?? ""));`,
  );
  check(
    "a medication's history reads newest first: the strength change, then started",
    history.join(",") === "changed:10 mg,started:5 mg",
    history.join(","),
  );

  const [recipient] = await onDevice(
    p,
    `const q = medications.recipientQuery(${JSON.stringify(DEV_FAMILY)}); return db.powersync.getAll(q.sql, q.params);`,
  );
  check(
    "the device has the recipient's time zone and date of birth",
    recipient?.time_zone === "America/Los_Angeles" && recipient?.date_of_birth === "1941-03-14",
    JSON.stringify(recipient),
  );

  const [notes] = await localRows(
    p,
    `SELECT d.subject, d.text FROM note_document d JOIN medication m ON m.id = d.medication_id WHERE m.name = 'Metformin' AND m.group_id = ?`,
    [DEV_FAMILY],
  );
  check(
    "the seeded medication notes are the medication's live document",
    notes?.subject === "medication" && /applesauce/.test(notes?.text ?? ""),
    JSON.stringify(notes),
  );

  const other = await localRows(p, "SELECT count(*) AS n FROM medication WHERE group_id = ?", [DEV_FAMILY_2]);
  check(
    "caretaker@ (not in Dev Family 2) has none of its medications",
    other[0]?.n === 0,
    JSON.stringify(other),
  );
}

async function writeSteps(p) {
  const name = `${TAG} Sertraline`;
  const created = await onDevice(
    p,
    `return medications.createMedication(db, ${JSON.stringify(DEV_FAMILY)}, {
       name: ${JSON.stringify(name)}, strength: "25 mg", form: "tablet", dose: "1 tablet",
       reason: "Mood", schedule: { type: "scheduled", times: ["20:00", "08:00"] },
     });`,
  );
  check("a writer adds a medication on the device", created.ok === true, JSON.stringify(created));
  if (!created.ok) return null;
  const id = created.id;

  const local = await localRows(
    p,
    `SELECT e.id, json_extract(e.details, '$.change') AS change, e.time_zone, m.updated_at
     FROM timeline_entry e JOIN medication m ON m.id = json_extract(e.details, '$.medicationId')
     WHERE m.id = ? AND e.kind = 'medicationChange'`,
    [id],
  );
  check(
    'its "started" entry is written with it, in the recipient\'s zone',
    local.length === 1 && local[0].change === "started" && local[0].time_zone === "America/Los_Angeles",
    JSON.stringify(local),
  );

  const uploaded = await waitForSql(
    `SELECT schedule->>'times' FROM medication WHERE id = '${id}'`,
    (v) => v !== "",
  );
  check("it uploads, with its schedule sorted", uploaded === '["08:00", "20:00"]', uploaded);
  const started = await waitForSql(
    `SELECT string_agg(id::text, ',') FROM timeline_entry WHERE kind = 'medicationChange' AND details->>'medicationId' = '${id}'`,
    (v) => v !== "",
  );
  check(
    "the server has exactly one change entry for it: the one the device wrote",
    started === local[0]?.id,
    `${started} vs ${local[0]?.id}`,
  );

  // A refill edit: no entry. A dose change, a discontinue and a restart: one each.
  const steps = [
    [
      "a refill edit writes no change entry",
      `{ refillsLeft: 2, quantity: "30 tablets" }`,
      1,
      "refills_left::text",
      "2",
    ],
    ["a dose change writes one", `{ dose: "2 tablets" }`, 2, "dose", "2 tablets"],
  ];
  for (const [label, patch, expected, column, value] of steps) {
    const res = await onDevice(
      p,
      `return medications.updateMedication(db, ${JSON.stringify(id)}, ${patch});`,
    );
    const server = await waitForSql(
      `SELECT ${column} FROM medication WHERE id = '${id}'`,
      (v) => v === value,
    );
    await sleep(500);
    const n = psql(CHANGES_SQL(id));
    check(
      label,
      res.ok === true && server === value && n === String(expected),
      `server ${server}, entries ${n}`,
    );
  }
  const noReason = await onDevice(
    p,
    `return medications.changeMedicationStatus(db, ${JSON.stringify(id)}, { status: "discontinued" });`,
  );
  check(
    "discontinuing without a reason is refused on the device, on the reason field",
    noReason.ok === false && noReason.issues.some((i) => i.path === "stopReason"),
    JSON.stringify(noReason),
  );
  const stopped = await onDevice(
    p,
    `return medications.changeMedicationStatus(db, ${JSON.stringify(id)}, { status: "discontinued", stopReason: "sideEffects", stopNote: "Nausea" });`,
  );
  const stoppedOn = await waitForSql(
    `SELECT status || ':' || stop_reason || ':' || (stopped_on IS NOT NULL)::text FROM medication WHERE id = '${id}'`,
    (v) => v.startsWith("discontinued"),
  );
  const restarted = await onDevice(
    p,
    `return medications.changeMedicationStatus(db, ${JSON.stringify(id)}, { status: "current" });`,
  );
  const current = await waitForSql(
    `SELECT status || ':' || (stopped_on IS NULL)::text FROM medication WHERE id = '${id}'`,
    (v) => v === "current:true",
  );
  const kinds = await waitForSql(
    `SELECT string_agg(details->>'change', ',' ORDER BY occurred_at) FROM timeline_entry WHERE kind = 'medicationChange' AND details->>'medicationId' = '${id}'`,
    (v) => v.split(",").length >= 4,
  );
  check(
    "discontinue (with today's date in the recipient's zone) and restart upload with one entry each",
    stopped.ok &&
      restarted.ok &&
      stoppedOn === "discontinued:sideEffects:true" &&
      current === "current:true" &&
      kinds === "started,changed,stopped,resumed",
    `${stoppedOn} ${current} ${kinds}`,
  );
  const localIds = await localRows(
    p,
    `SELECT id FROM timeline_entry WHERE kind = 'medicationChange' AND json_extract(details, '$.medicationId') = ? ORDER BY id`,
    [id],
  );
  const serverIds = psql(
    `SELECT string_agg(id::text, ',' ORDER BY id) FROM timeline_entry WHERE kind = 'medicationChange' AND details->>'medicationId' = '${id}'`,
  );
  check(
    "the device's change entries and the server's are the same rows",
    localIds.map((r) => r.id).join(",") === serverIds,
    `${localIds.length} local`,
  );

  // Doses.
  const dose = await onDevice(
    p,
    `return medications.logDose(db, ${JSON.stringify(DEV_FAMILY)}, { medicationId: ${JSON.stringify(id)}, status: "given", amount: "2 tablets", scheduledFor: "08:00" });`,
  );
  const doseUp = dose.ok
    ? await waitForSql(
        `SELECT details->>'status' FROM timeline_entry WHERE id = '${dose.id}'`,
        (v) => v === "given",
      )
    : "";
  check("a writer logs a dose, and it uploads", dose.ok === true && doseUp === "given", JSON.stringify(dose));
  if (dose.ok) {
    const edited = await onDevice(
      p,
      `return medications.updateDose(db, ${JSON.stringify(dose.id)}, { status: "skipped", note: "Asleep" });`,
    );
    const editUp = await waitForSql(
      `SELECT details->>'status' || ':' || (details->>'note') FROM timeline_entry WHERE id = '${dose.id}'`,
      (v) => v === "skipped:Asleep",
    );
    const today = await onDevice(
      p,
      `const { from, to } = medications.dayBounds(new Date(), "America/Los_Angeles");
       const q = medications.groupDosesQuery(${JSON.stringify(DEV_FAMILY)}, from, to);
       return medications.toMedicationEntries(await db.powersync.getAll(q.sql, q.params)).some((e) => e.id === ${JSON.stringify(dose.id)});`,
    );
    const removed = await onDevice(
      p,
      `return medications.removeMedicationEntry(db, ${JSON.stringify(dose.id)});`,
    );
    const gone = await waitForSql(
      `SELECT (deleted_at IS NOT NULL)::text FROM timeline_entry WHERE id = '${dose.id}'`,
      (v) => v === "true",
    );
    check(
      "the dose is edited, shows among the recipient's day's doses, and is deleted, everywhere",
      edited.ok && editUp === "skipped:Asleep" && today === true && removed.ok && gone === "true",
      `${editUp} ${today} ${gone}`,
    );
  }
  const stray = await onDevice(
    p,
    `return medications.logDose(db, ${JSON.stringify(DEV_FAMILY)}, { medicationId: crypto.randomUUID(), status: "given" });`,
  );
  check(
    "a dose for a medication that isn't on the device is refused",
    stray.ok === false,
    JSON.stringify(stray),
  );
  return id;
}

// --- The list and a medication's page (slice 2) ------------------------------

const BAR = `document.querySelector('nav.dock[aria-label="Group sections"]')`;
const HEADER_NAV = `document.querySelector('header [data-region="sections"] nav[aria-label="Group sections"]')`;
const navState = (nav) => `(() => {
  const links = [...(${nav}?.querySelectorAll("a") ?? [])];
  return {
    labels: links.map((a) => a.textContent.trim()).join(","),
    current: links.filter((a) => a.getAttribute("aria-current") === "page").map((a) => a.textContent.trim()).join(","),
    inside: links.filter((a) => a.getAttribute("aria-current") === "true").map((a) => a.textContent.trim()).join(","),
  };
})()`;
const metrics = (p, width, mobile) =>
  p.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile });
const LIST = `/app/groups/${DEV_FAMILY}/medications`;
const medPath = (id, group = DEV_FAMILY) => `/app/groups/${group}/medications/${id}`;
/** The names in one of the list's lists, leaving out every run's tagged medications. */
const listNames = (label) =>
  `[...document.querySelectorAll('main ul[aria-label="${label}"] [data-medication-name]')].map((n) => n.textContent.trim()).filter((n) => !n.startsWith("MV-"))`;
const listState = (p) =>
  p.evaluate(`({
    path: location.pathname,
    search: location.search,
    box: document.querySelector('main input[type="search"]')?.value,
    current: ${listNames("Current medications")},
    stopped: ${listNames("Completed and discontinued medications")},
    discontinued: ${listNames("Discontinued medications")},
    chip: document.querySelector('main nav[aria-label="Show medications"] [aria-current="true"]')?.textContent.trim(),
  })`);
const rowText = (name, field) =>
  `[...document.querySelectorAll("main li[data-medication-id]")].find((li) => li.querySelector("[data-medication-name]")?.textContent.trim().startsWith(${JSON.stringify(name)}))?.querySelector("[data-medication-${field}]")?.textContent.trim()`;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const SEEDED_CURRENT = ["Acetaminophen 500 mg", "Latanoprost 0.005%", "Lisinopril 10 mg", "Metformin 500 mg"];
const NOTES = `document.querySelector("main .ProseMirror")`;
const notesHave = (text) => `!!${NOTES}?.textContent.includes(${JSON.stringify(text)})`;
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
async function typeNotes(p, text) {
  await p.evaluate(`(() => { const el = ${NOTES}; el.focus();
    const sel = getSelection(); sel.selectAllChildren(el); sel.collapseToEnd(); return true; })()`);
  await p.send("Input.insertText", { text });
}
const medicationId = async (p, name, group = DEV_FAMILY) =>
  (await localRows(p, "SELECT id FROM medication WHERE group_id = ? AND name = ?", [group, name]))[0]?.id;
const NOT_FOUND = `document.querySelector("main h1")?.textContent === "Not found"`;

/** The tab and header link, the list, search and the status filter (caretaker@, A). */
async function listSteps(p) {
  await p.goto(`/app/groups/${DEV_FAMILY}/timeline`);
  await p.waitFor(`location.pathname.endsWith("/timeline") && !!${BAR}`, 30000).catch(() => {});
  const bar = await p.evaluate(navState(BAR));
  check(
    "420: the tab bar shows Medications after Providers",
    bar.labels.startsWith("Timeline,Providers,Medications") && bar.current === "Timeline",
    JSON.stringify(bar),
  );
  await p.tap(`[...${BAR}.querySelectorAll("a")].find((a) => a.textContent.trim() === "Medications")`);
  await p.waitFor(`location.pathname.endsWith("/medications")`, 15000).catch(() => {});
  await p
    .waitFor(
      `(() => { const names = ${listNames("Current medications")}; return names.length >= 4; })()`,
      20000,
    )
    .catch(() => {});
  const tab = await p.evaluate(navState(BAR));
  check(
    "420: the Medications tab opens the list and is marked current",
    tab.current === "Medications" &&
      (await p.evaluate(`document.querySelector("main h1")?.textContent`)) === "Medications",
    JSON.stringify(tab),
  );

  const seeded = await listState(p);
  check(
    "the seeded list: the four current medications first, by name, then the completed and discontinued ones",
    same(seeded.current, SEEDED_CURRENT) && same(seeded.stopped, ["Amoxicillin 500 mg", "Oxybutynin 5 mg"]),
    JSON.stringify({ current: seeded.current, stopped: seeded.stopped }),
  );
  const rows = await p.evaluate(`({
    metformin: ${rowText("Metformin", "summary")},
    acetaminophen: ${rowText("Acetaminophen", "summary")},
    reason: ${rowText("Lisinopril", "reason")},
    oxybutynin: ${rowText("Oxybutynin", "stopped")},
    amoxicillin: ${rowText("Amoxicillin", "stopped")},
  })`);
  check(
    "each row shows form, dose, schedule and reason; a stopped one says how, when and why",
    rows.metformin === "Tablet · 1 tablet · 8:00 and 20:00" &&
      rows.acetaminophen === "Tablet · 2 tablets · As needed, up to 4 a day" &&
      rows.reason === "Reason: Blood pressure" &&
      /^Discontinued \w{3} \d{1,2}, \d{4} · Side effects$/.test(rows.oxybutynin ?? "") &&
      /^Completed \w{3} \d{1,2}, \d{4}$/.test(rows.amoxicillin ?? ""),
    JSON.stringify(rows),
  );
  await p.screenshot("medications-list");

  // Search: what's typed filters at once and goes in the URL; a reload keeps it.
  await p.type(`document.querySelector('main input[type="search"]')`, "blood");
  await p.waitFor(`location.search === "?q=blood"`, 10000).catch(() => {});
  await p.goto(`${LIST}?q=blood`);
  await p
    .waitFor(`(() => { const n = ${listNames("Current medications")}; return n.length === 1; })()`, 20000)
    .catch(() => {});
  const searched = await listState(p);
  check(
    'searching "blood" (by reason) finds Lisinopril, and survives a reload',
    same(searched.current, ["Lisinopril 10 mg"]) &&
      searched.stopped.length === 0 &&
      searched.box === "blood" &&
      searched.search === "?q=blood",
    JSON.stringify(searched),
  );

  // The status filter: a chip, in the URL, kept on reload; All clears it.
  await p.goto(LIST);
  await p.waitFor(`!!document.querySelector('main nav[aria-label="Show medications"]')`, 20000);
  await p.tap(
    `[...document.querySelectorAll('main nav[aria-label="Show medications"] a')].find((a) => a.textContent.trim() === "Discontinued")`,
  );
  await p.waitFor(`location.search === "?status=discontinued"`, 10000).catch(() => {});
  await p.goto(`${LIST}?status=discontinued`);
  await p
    .waitFor(`(() => { const n = ${listNames("Discontinued medications")}; return n.length >= 1; })()`, 20000)
    .catch(() => {});
  const filtered = await listState(p);
  check(
    "the Discontinued chip shows only Oxybutynin, and survives a reload",
    same(filtered.discontinued, ["Oxybutynin 5 mg"]) &&
      filtered.current.length === 0 &&
      filtered.chip === "Discontinued" &&
      filtered.search === "?status=discontinued",
    JSON.stringify(filtered),
  );
  await p.tap(
    `[...document.querySelectorAll('main nav[aria-label="Show medications"] a')].find((a) => a.textContent.trim() === "All")`,
  );
  await p.waitFor(`location.search === "" && ${listNames("Current medications")}.length >= 4`, 10000).then(
    () => check("…and All shows everything again", true),
    () => check("…and All shows everything again", false),
  );

  // 1280: the header's links, Medications current; inside a medication, "true".
  await metrics(p, 1280, false);
  await p
    .waitFor(`!!${HEADER_NAV} && getComputedStyle(${HEADER_NAV}).display !== "none"`, 10000)
    .catch(() => {});
  const wide = await p.evaluate(navState(HEADER_NAV));
  check(
    "1280: the header links show Medications after Providers, marked current",
    wide.labels.startsWith("Timeline,Providers,Medications") && wide.current === "Medications",
    JSON.stringify(wide),
  );
  await p.screenshot("medications-list-wide");
  await metrics(p, 420, true);
}

/** A medication's page: details, providers, history (caretaker@, A). */
async function pageSteps(p) {
  await p.goto(LIST);
  await p
    .waitFor(`(() => { const n = ${listNames("Current medications")}; return n.length >= 4; })()`, 20000)
    .catch(() => {});
  const lisinopril = await medicationId(p, "Lisinopril");
  // A tap on the row (not only the name) opens the page.
  await p.tap(
    `document.querySelector('main li[data-medication-id="${lisinopril}"] [data-medication-summary]')`,
  );
  await p.waitFor(onMedPage(lisinopril), 20000).catch(() => {});
  const page = await medPage(p);
  // Schedule times are the recipient's: the page says so when this device is elsewhere.
  const zone = await p.evaluate(`Intl.DateTimeFormat().resolvedOptions().timeZone`);
  check(
    "a tap on a row opens the medication's page, with its details (and the recipient's zone when it isn't the device's)",
    page.h1 === "Lisinopril 10 mg" &&
      page.badge === null &&
      page.details === "Tablet · 1 tablet" &&
      page.rows.schedule === (zone === "America/Los_Angeles" ? "8:00" : "8:00Times are Los Angeles time") &&
      page.rows.reason === "Blood pressure" &&
      page.rows.directions?.startsWith("Once every morning") &&
      !!page.rows.started,
    JSON.stringify({ zone, h1: page.h1, details: page.details, rows: page.rows }),
  );
  const alvarez = psql(
    `SELECT id FROM provider WHERE group_id = '${DEV_FAMILY}' AND name = 'Dr. Elena Alvarez'`,
  );
  const cornerstone = psql(
    `SELECT id FROM provider WHERE group_id = '${DEV_FAMILY}' AND name = 'Cornerstone Pharmacy'`,
  );
  check(
    "the prescriber and the pharmacy are links to their pages, with contact actions",
    same(page.providers, [
      ["prescriber", "Dr. Elena Alvarez", `/app/groups/${DEV_FAMILY}/providers/${alvarez}`, true],
      ["pharmacy", "Cornerstone Pharmacy", `/app/groups/${DEV_FAMILY}/providers/${cornerstone}`, true],
    ]),
    JSON.stringify(page.providers),
  );
  const expected = await onDevice(
    p,
    `const q = medications.medicationEntriesQuery(${JSON.stringify(lisinopril)});
     return (await db.powersync.getAll(q.sql, q.params)).map((r) => r.id);`,
  );
  const changes = page.history.filter((h) => h.kind === "medicationChange").map((h) => h.text);
  const doses = page.history.filter((h) => h.kind === "dose");
  check(
    "its history: the seeded doses and changes, newest first",
    page.history.length > 3 &&
      same(
        page.history.map((h) => h.id),
        expected,
      ) &&
      same(changes, ["Changed strength 5 mg → 10 mg", "Started"]) &&
      page.history.at(-1)?.text === "Started" &&
      doses.some((d) => d.text === "Given 1 tablet"),
    JSON.stringify({ changes, doses: doses.length, n: page.history.length }),
  );
  await p.screenshot("medication-page");

  // Tapping the prescriber opens their page.
  await p.tap(
    `document.querySelector('main li[data-medication-provider="prescriber"] a[data-provider-name]')`,
  );
  await p.waitFor(`location.pathname.endsWith("/providers/${alvarez}")`, 15000).then(
    () => check("tapping the prescriber opens their provider page", true),
    () => check("tapping the prescriber opens their provider page", false),
  );

  // A stopped medication: its status, how and why it stopped, and refills.
  const oxy = await medicationId(p, "Oxybutynin");
  await p.goto(medPath(oxy));
  await p.waitFor(onMedPage(oxy), 20000).catch(() => {});
  const stopped = await medPage(p);
  check(
    "a discontinued medication's page says so, with the reason and the note",
    stopped.badge === "Discontinued" &&
      /^Discontinued \w{3} \d{1,2}, \d{4} · Side effects/.test(stopped.stopped ?? "") &&
      stopped.stopped?.includes("Dry mouth") &&
      stopped.history[0]?.text === "Discontinued: side effects",
    JSON.stringify({ badge: stopped.badge, stopped: stopped.stopped, first: stopped.history[0] }),
  );
  const lat = await medicationId(p, "Latanoprost");
  await p.goto(medPath(lat));
  await p
    .waitFor(`${onMedPage(lat)} && !!document.querySelector("main li[data-medication-provider]")`, 20000)
    .catch(() => {});
  const refills = await medPage(p);
  check(
    "refill details show on the page (and the refill wrote no change entry)",
    refills.rows.quantity === "1 bottle (2.5 mL)" &&
      refills.rows["refills-left"] === "3" &&
      refills.rows["rx-number"] === "RX 0104-2277" &&
      !!refills.rows["last-filled"] &&
      same(
        refills.history.filter((h) => h.kind === "medicationChange").map((h) => h.text),
        ["Started"],
      ) &&
      same(
        refills.providers.map((x) => x[0]),
        ["pharmacy"],
      ),
    JSON.stringify({ rows: refills.rows, providers: refills.providers }),
  );
  return lisinopril;
}

/** Live notes on a medication: A (caretaker) and B (member) converge; returns the run's medication's id. */
async function notesSteps(A, B) {
  const metformin = await medicationId(A, "Metformin");
  await A.goto(medPath(metformin));
  await A.waitFor(`${onMedPage(metformin)} && ${notesHave("applesauce")}`, 20000).catch(() => {});
  const seeded = await medPage(A);
  check(
    "the seeded notes show in the editor, writable for a caretaker, with the Edit and status actions",
    seeded.notes?.includes("applesauce") && seeded.editable === "true" && seeded.actions,
    JSON.stringify({ notes: seeded.notes?.slice(0, 40), editable: seeded.editable, actions: seeded.actions }),
  );

  const made = await onDevice(
    A,
    `return medications.createMedication(db, ${JSON.stringify(DEV_FAMILY)}, {
       name: ${JSON.stringify(`${TAG} Notes`)}, strength: "50 mg", form: "tablet", dose: "1 tablet",
       schedule: { type: "asNeeded" },
     });`,
  );
  const id = made.id;
  await waitForSql(`SELECT count(*) FROM medication WHERE id = '${id}'`, (v) => v === "1");
  await A.goto(medPath(id));
  await A.waitFor(onMedPage(id), 20000).catch(() => {});
  await B.goto(medPath(id));
  await B.waitFor(onMedPage(id), 30000).catch(() => {});
  check(
    "a medication without notes opens with an empty editor, and no document yet",
    (await medPage(A)).notes === "" && psql(`SELECT count(*) FROM note_document WHERE id = '${id}'`) === "0",
  );

  await typeNotes(A, `${TAG} crush into yogurt`);
  const doc = await waitForSql(
    `SELECT subject || '|' || coalesce(medication_id::text, '') || '|' || coalesce(entry_id::text, '-') FROM note_document WHERE id = '${id}'`,
    (v) => v !== "",
  );
  check(
    "the first keystroke makes the medication's document (subject medication)",
    doc === `medication|${id}|-`,
    doc,
  );
  await B.waitFor(notesHave(`${TAG} crush into yogurt`), 20000).then(
    () => check("a second browser sees the notes as they're written", true),
    () => check("a second browser sees the notes as they're written", false),
  );
  await typeNotes(B, " with breakfast");
  await A.waitFor(notesHave("with breakfast"), 20000).then(
    () => check("…and the first sees the second's edits (converged)", true),
    () => check("…and the first sees the second's edits (converged)", false),
  );
  const texts = [await A.evaluate(`${NOTES}.textContent`), await B.evaluate(`${NOTES}.textContent`)];
  check("both browsers have the same text", texts[0] === texts[1], JSON.stringify(texts));
  return id;
}

/** Offline (A behind `proxy`): the list and a page open from the device's copy. */
async function offlineSteps(p, proxy) {
  await p.goto(LIST);
  await p
    .waitFor(`(() => { const n = ${listNames("Current medications")}; return n.length >= 4; })()`, 20000)
    .catch(() => {});
  const errorsBefore = p.errors.length;
  proxy.setOnline(false);
  await p.waitFor(`!window.caretookSync.powersync.currentStatus.connected`, 15000).catch(() => {});
  await p.tap(`[...${BAR}.querySelectorAll("a")].find((a) => a.textContent.trim() === "Timeline")`);
  await p.waitFor(`location.pathname.endsWith("/timeline")`, 15000).catch(() => {});
  await p.tap(`[...${BAR}.querySelectorAll("a")].find((a) => a.textContent.trim() === "Medications")`);
  await p
    .waitFor(`(() => { const n = ${listNames("Current medications")}; return n.length >= 4; })()`, 15000)
    .catch(() => {});
  const list = await listState(p);
  check(
    "offline: the list opens from the device's copy",
    same(list.current, SEEDED_CURRENT),
    JSON.stringify(list.current),
  );
  const metformin = await medicationId(p, "Metformin");
  await p.tap(`document.querySelector('main li[data-medication-id="${metformin}"] [data-medication-name]')`);
  await p.waitFor(`${onMedPage(metformin)} && ${notesHave("applesauce")}`, 15000).catch(() => {});
  const page = await medPage(p);
  check(
    "offline: a medication's page opens, with its notes and history",
    page.h1 === "Metformin 500 mg" && page.notes?.includes("applesauce") && page.history.length > 0,
    JSON.stringify({ h1: page.h1, history: page.history.length }),
  );
  proxy.setOnline(true);
  await p.waitFor(`window.caretookSync.powersync.currentStatus.connected`, 30000).catch(() => {});
  p.errors.splice(errorsBefore); // Offline fetch failures aren't the app's errors.
}

/** viewer@ (C): the list, and the notes read-only. */
async function viewerSteps(C, notesId) {
  await C.goto(LIST);
  await C.waitFor(
    `(() => { const n = ${listNames("Current medications")}; return n.length >= 4; })()`,
    30000,
  ).catch(() => {});
  const list = await listState(C);
  const sub = await C.evaluate(`document.querySelector("main header p")?.textContent ?? ""`);
  check(
    "a viewer sees the list, told it's view-only",
    same(list.current, SEEDED_CURRENT) && sub.includes("You can view this list"),
    JSON.stringify({ current: list.current, sub }),
  );
  await C.goto(medPath(notesId));
  await C.waitFor(`${onMedPage(notesId)} && ${notesHave("with breakfast")}`, 30000).catch(() => {});
  const page = await medPage(C);
  check(
    "a viewer reads a medication's notes, read-only, with no edit controls",
    page.notes?.includes(`${TAG} crush into yogurt`) &&
      page.editable === "false" &&
      page.readonly === "true" &&
      !page.actions,
    JSON.stringify({ editable: page.editable, readonly: page.readonly, actions: page.actions }),
  );
}

/** 404s with no names: a deleted medication, another group's under this group, a non-member's. */
async function notFoundSteps(member, caretaker) {
  const gone = await onDevice(
    member,
    `const made = await medications.createMedication(db, ${JSON.stringify(DEV_FAMILY)}, {
       name: ${JSON.stringify(`${TAG} Deleted`)}, schedule: { type: "asNeeded" },
     });
     await medications.removeMedication(db, made.id);
     return made.id;`,
  );
  await member.goto(medPath(gone));
  await member.waitFor(NOT_FOUND, 20000).catch(() => {});
  const deleted = await member.evaluate(`({
    h1: document.querySelector("main h1")?.textContent,
    leaks: (document.querySelector("main")?.innerText ?? "").includes(${JSON.stringify(TAG)}),
  })`);
  check(
    "a deleted medication's URL is the 404, with no names",
    deleted.h1 === "Not found" && !deleted.leaks,
    JSON.stringify(deleted),
  );

  const tamsulosin = await medicationId(member, "Tamsulosin", DEV_FAMILY_2);
  await member.goto(medPath(tamsulosin));
  await member.waitFor(NOT_FOUND, 20000).catch(() => {});
  const crossed = await member.evaluate(`({
    h1: document.querySelector("main h1")?.textContent,
    leaks: /Tamsulosin|Prostate/.test(document.querySelector("main")?.innerText ?? ""),
  })`);
  check(
    "another group's medication under this group's URL is the 404, with no names",
    crossed.h1 === "Not found" && !crossed.leaks,
    JSON.stringify(crossed),
  );
  await member.goto(medPath(tamsulosin, DEV_FAMILY_2));
  await member.waitFor(onMedPage(tamsulosin), 20000).then(
    () => check("…and opens under its own group", true),
    () => check("…and opens under its own group", false),
  );

  // caretaker@ isn't in Dev Family 2.
  await caretaker.goto(medPath(tamsulosin, DEV_FAMILY_2));
  await caretaker.waitFor(NOT_FOUND, 20000).catch(() => {});
  const outsider = await caretaker.evaluate(`({
    h1: document.querySelector("main h1")?.textContent,
    leaks: /Tamsulosin|Prostate|Grandpa Lou/.test(document.querySelector("main")?.innerText ?? ""),
  })`);
  check(
    "a non-member's medication URL is the 404, with no names",
    outsider.h1 === "Not found" && !outsider.leaks,
    JSON.stringify(outsider),
  );
}

// ---------------------------------------------------------------------------
// Doses and changes on the timeline (slice 4).
// ---------------------------------------------------------------------------

const ROWS = `[...document.querySelectorAll("main ol > li")]`;
const rowWith = (text) => `${ROWS}.find((li) => li.textContent.includes(${JSON.stringify(text)}))`;
const rowKinds = `[...new Set(${ROWS}.map((li) => li.querySelector(".sr-only")?.textContent))].join(",")`;
const SHEET = `document.querySelector("[role=dialog]")`;
const SUBMIT = `${SHEET}?.querySelector('button[type="submit"]')`;
const radio = (name, label) =>
  `${SHEET}?.querySelector('input[name="${name}"][aria-label=${JSON.stringify(label)}]')`;
const AMOUNT = `${SHEET}?.querySelector('input[name="amount"]')`;
const NOTE = `${SHEET}?.querySelector('textarea[name="note"]')`;
const QUICK_ADD = `document.querySelector('[aria-label="Add to the timeline"]')`;
const tile = (text) =>
  `[...(${QUICK_ADD}?.querySelectorAll("a, button") ?? [])].find((b) => b.textContent.trim() === ${JSON.stringify(text)})`;
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

/** Open the Dose sheet from the quick-add bar and log a dose of `label`. */
async function logDoseInSheet(p, label, { status = "given", note = "", yesterday = false } = {}) {
  await p.tap(tile("Dose"));
  await p.waitFor(radio("medicationId", label), 8000);
  await p.tap(radio("medicationId", label));
  if (status !== "given") await p.tap(`${SHEET}.querySelector('input[name="status"][value="${status}"]')`);
  if (note) await p.type(NOTE, note);
  if (yesterday) {
    // The calendar (keyboard, so a month boundary works too): open, one day back, pick.
    await p.evaluate(`${PICK}.focus()`);
    await pressKey(p, "Enter", "Enter", 13, "\r");
    await p.waitFor(`${GRID} && document.activeElement?.closest("[role=grid]")`, 5000);
    await pressKey(p, "ArrowLeft", "ArrowLeft", 37);
    await pressKey(p, "Enter", "Enter", 13, "\r");
    await p.waitFor(`!${GRID}`, 3000);
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
  await A.waitFor(`document.querySelector('ol[data-view="cards"]')`, 5000).catch(() => undefined);
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
  await A.waitFor(`document.querySelector('ol[data-view="rows"]')`, 5000).catch(() => undefined);

  // A change opens nothing and its ⋯ menu has Delete only.
  const changeRow = rowWith("Changed strength 5 mg → 10 mg");
  const opens = await A.evaluate(
    `!!${changeRow}.querySelector('a[aria-label^="Edit "], a[aria-label^="Open "]')`,
  );
  await A.press(`${changeRow}.querySelector('button[aria-label^="Actions for"]')`);
  await A.waitFor(`${menuItems}.length > 0`, 5000);
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

  // The quick-add bar: Note, Event, Dose, Symptom, Vitals (B-43).
  const tiles = await A.evaluate(
    `[...(${QUICK_ADD}?.querySelectorAll("a, button") ?? [])].map((b) => b.textContent.trim()).join(",")`,
  );
  check(
    "quick add reads Note, Event, Dose, Symptom, Vitals",
    tiles === "Note,Event,Dose,Symptom,Vitals",
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
  await A.tap(tile("Dose"));
  await A.waitFor(radio("medicationId", label), 8000);
  const options = await A.evaluate(
    `[...${SHEET}.querySelectorAll('input[name="medicationId"]')].map((r) => r.getAttribute("aria-label"))`,
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
  await A.waitFor(`${AMOUNT}.value === "2 tablets"`, 3000).catch(() => undefined);
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
  await A.waitFor(`${menuItems}.length > 0`, 5000);
  const doseItems = await A.evaluate(`${menuItems}.join(",")`);
  await A.press(menuItem("Delete"));
  await A.waitFor(`document.querySelector("dialog[open]")`, 5000);
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
  await A.waitFor(menuItem("Delete"), 5000);
  await A.press(menuItem("Delete"));
  await A.waitFor(`document.querySelector("dialog[open]")`, 5000);
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
      `JSON.stringify({ bar: !!${QUICK_ADD}, opens: !!document.querySelector('main ol a[aria-label^="Edit "], main ol a[aria-label^="Open "]'), menus: !!document.querySelector('main ol button[aria-label^="Actions"]'), rows: ${ROWS}.length })`,
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

// Slice 6: the printable sheet and the provider page's medications
// ---------------------------------------------------------------------------

const onPrint = `location.pathname.endsWith("/medications/print") && document.querySelectorAll("main [data-print-medication]").length >= 4`;
/** The sheet as the DOM has it, leaving out every run's tagged medications. */
const printState = (p) =>
  p.evaluate(`(() => {
    const titles = (sel) => [...document.querySelectorAll(sel)].map((r) => r.querySelector("[data-print-title]")?.firstChild?.textContent.trim() ?? "").filter((t) => !t.startsWith("MV-"));
    const field = (f) => document.querySelector('main [data-print-field="' + f + '"]')?.textContent.trim() ?? null;
    return {
      name: field("name"), dob: field("dateOfBirth"), group: field("group"), printed: field("printed"),
      current: titles("main tr[data-print-medication]"),
      prescribers: Object.fromEntries([...document.querySelectorAll("main tr[data-print-medication]")].map((r) => [r.querySelector("[data-print-title]")?.firstChild?.textContent.trim(), r.querySelector("[data-print-prescriber]")?.textContent.trim()])),
      stopped: [...document.querySelectorAll("main tr[data-print-stopped]")].map((r) => [r.querySelector("[data-print-title]")?.textContent.trim(), r.querySelector("[data-print-when]")?.textContent.trim(), r.querySelector("[data-print-why]")?.textContent.trim()]),
      contacts: [...document.querySelectorAll("main tr[data-print-contact]")].map((r) => [r.querySelector("[data-print-title]")?.textContent.trim(), r.querySelector("[data-print-phone]")?.firstChild?.textContent.trim()]),
    };
  })()`);
/** What printing would show: the frame and every control hidden, black on white, nothing wider than the page. */
const printLayout = (p) =>
  p.evaluate(`(() => {
    const shown = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
    const tables = [...document.querySelectorAll("main [data-print-sheet] table")];
    return {
      header: shown(document.querySelector("header.navbar")),
      tabBar: shown(document.querySelector('nav.dock[aria-label="Group sections"]')),
      controls: [...document.querySelectorAll("button, a.btn, input, [role=button]")].filter(shown).map((el) => el.textContent.trim() || el.tagName),
      tables: tables.length,
      fits: tables.every((t) => t.getBoundingClientRect().right <= document.documentElement.clientWidth + 0.5 && t.scrollWidth <= t.clientWidth + 1),
      pageFits: document.documentElement.scrollWidth <= innerWidth,
      background: getComputedStyle(document.body).backgroundColor,
      color: getComputedStyle(document.querySelector("main [data-print-sheet] h1")).color,
      cell: getComputedStyle(document.querySelector("main [data-print-sheet] td")).color,
    };
  })()`);

/** The sheet from the list's Print link: what's on it, the Print button, and print media at 420 and 1280 (A). */
async function printSteps(p) {
  await p.goto(LIST);
  await p.waitFor(`!!document.querySelector("main a[data-print-link]")`, 20000).catch(() => {});
  await p.tap(`document.querySelector("main a[data-print-link]")`);
  await p.waitFor(onPrint, 20000).catch(() => {});
  const sheet = await printState(p);
  const dob = psql(`SELECT date_of_birth FROM care_recipient WHERE group_id = '${DEV_FAMILY}'`);
  check(
    "the list's Print link opens the sheet: the recipient, the date of birth, the group and the day printed",
    sheet.name?.includes("Grandma Pat") &&
      dob === "1941-03-14" &&
      sheet.dob === "Mar 14, 1941" &&
      sheet.group === "Dev Family" &&
      /^\w{3} \d{1,2}, \d{4}$/.test(sheet.printed ?? ""),
    JSON.stringify({ name: sheet.name, dob: sheet.dob, group: sheet.group, printed: sheet.printed }),
  );
  check(
    "the sheet lists the seeded current medications by name, with their prescriber",
    same(sheet.current, SEEDED_CURRENT) &&
      sheet.prescribers["Lisinopril 10 mg"] === "Dr. Elena Alvarez" &&
      sheet.prescribers["Latanoprost 0.005%"] === "",
    JSON.stringify({ current: sheet.current, prescribers: sheet.prescribers }),
  );
  check(
    "…the completed antibiotic and the discontinued one with its reason, most recently stopped first",
    sheet.stopped.length === 2 &&
      sheet.stopped[0][0] === "Amoxicillin 500 mg" &&
      /^Completed \w{3} \d{1,2}, \d{4}$/.test(sheet.stopped[0][1]) &&
      sheet.stopped[1][0].startsWith("Oxybutynin") &&
      /^Discontinued \w{3} \d{1,2}, \d{4}$/.test(sheet.stopped[1][1]) &&
      sheet.stopped[1][2]?.startsWith("Side effects"),
    JSON.stringify(sheet.stopped),
  );
  check(
    "…and the prescriber's and pharmacy's first phones, once each",
    same(sheet.contacts, [
      ["Dr. Elena Alvarez", "(555) 010-2200 x214"],
      ["Cornerstone Pharmacy", "(555) 010-4400"],
    ]),
    JSON.stringify(sheet.contacts),
  );

  // The Print button prints (stubbed: headless Chrome has no print dialog).
  await p.evaluate(`window.__printed = 0; window.print = () => { window.__printed++; }; true`);
  await p.tap(`[...document.querySelectorAll("main button")].find((b) => b.textContent.trim() === "Print")`);
  check("the Print button calls window.print()", (await p.evaluate(`window.__printed`)) === 1);

  // Print media: no frame, no buttons, black on white (even in the dark theme), the tables within the page.
  const layouts = {};
  for (const [width, mobile] of [
    [420, true],
    [1280, false],
  ]) {
    await metrics(p, width, mobile);
    await p.send("Emulation.setEmulatedMedia", { media: "print" });
    await sleep(300);
    layouts[width] = await printLayout(p);
    await p.screenshot(`medications-print-${width}`);
  }
  await p.evaluate(`document.documentElement.dataset.theme = "dark"; true`);
  await sleep(200);
  const dark = await printLayout(p);
  await p.evaluate(`delete document.documentElement.dataset.theme; true`);
  await p.send("Emulation.setEmulatedMedia", { media: "" });
  await metrics(p, 420, true);
  const clean = (l) => !l.header && !l.tabBar && l.controls.length === 0 && l.tables === 3;
  check(
    "printed, the sheet has no header, tab bar or buttons, at 420 and 1280",
    clean(layouts[420]) && clean(layouts[1280]),
    JSON.stringify(layouts),
  );
  check(
    "printed, the tables fit the page width at 420 and 1280",
    layouts[420].fits && layouts[420].pageFits && layouts[1280].fits && layouts[1280].pageFits,
    JSON.stringify({
      420: [layouts[420].fits, layouts[420].pageFits],
      1280: [layouts[1280].fits, layouts[1280].pageFits],
    }),
  );
  const black = (l) =>
    l.background === "rgb(255, 255, 255)" && l.color === "rgb(0, 0, 0)" && l.cell === "rgb(0, 0, 0)";
  check(
    "printed, it's black on white, in the dark theme too",
    black(layouts[1280]) && black(dark),
    JSON.stringify({
      light: [layouts[1280].background, layouts[1280].color],
      dark: [dark.background, dark.color],
    }),
  );
}

/** Offline (A behind `proxy`): the sheet opens from the device's copy. */
async function printOfflineSteps(p, proxy) {
  await p.goto(LIST);
  await p.waitFor(`!!document.querySelector("main a[data-print-link]")`, 20000).catch(() => {});
  const errorsBefore = p.errors.length;
  proxy.setOnline(false);
  await p.waitFor(`!window.caretookSync.powersync.currentStatus.connected`, 15000).catch(() => {});
  await p.tap(`document.querySelector("main a[data-print-link]")`);
  await p.waitFor(onPrint, 15000).catch(() => {});
  const sheet = await printState(p);
  check(
    "offline: the sheet opens from the device's copy, with the date of birth and phones",
    same(sheet.current, SEEDED_CURRENT) && sheet.dob === "Mar 14, 1941" && sheet.contacts.length === 2,
    JSON.stringify({ current: sheet.current, dob: sheet.dob, contacts: sheet.contacts.length }),
  );
  proxy.setOnline(true);
  await p.waitFor(`window.caretookSync.powersync.currentStatus.connected`, 30000).catch(() => {});
  p.errors.splice(errorsBefore);
}

/** The provider page's Medications: the prescriber's and the pharmacy's current medications (A). */
async function providerMedicationSteps(p) {
  const providerPath = (name) =>
    `/app/groups/${DEV_FAMILY}/providers/${psql(`SELECT id FROM provider WHERE group_id = '${DEV_FAMILY}' AND name = '${name}'`)}`;
  const region = (p) =>
    p.evaluate(
      `[...document.querySelectorAll("main [data-provider-medications] a[data-medication-id]")].map((a) => [a.querySelector("[data-medication-name]")?.textContent.trim(), a.querySelector("[data-medication-role]")?.textContent.trim()]).filter(([n]) => !n.startsWith("MV-"))`,
    );
  const ready = `!!document.querySelector("main [data-provider-medications] a[data-medication-id]")`;

  await p.goto(providerPath("Dr. Elena Alvarez"));
  await p.waitFor(ready, 20000).catch(() => {});
  const prescribed = await region(p);
  check(
    "a prescriber's page lists the current medications they prescribe (not stopped ones)",
    same(prescribed, [
      ["Lisinopril 10 mg", "Prescribes"],
      ["Metformin 500 mg", "Prescribes"],
    ]),
    JSON.stringify(prescribed),
  );

  await p.goto(providerPath("Cornerstone Pharmacy"));
  await p.waitFor(ready, 20000).catch(() => {});
  const filled = await region(p);
  check(
    "the pharmacy's page lists the current medications it fills",
    same(filled, [
      ["Latanoprost 0.005%", "Fills"],
      ["Lisinopril 10 mg", "Fills"],
      ["Metformin 500 mg", "Fills"],
    ]),
    JSON.stringify(filled),
  );
  const lat = await medicationId(p, "Latanoprost");
  await p.tap(`document.querySelector('main [data-provider-medications] a[data-medication-id="${lat}"]')`);
  await p.waitFor(onMedPage(lat), 15000).then(
    () => check("…and each opens its medication page", true),
    () => check("…and each opens its medication page", false),
  );

  await p.goto(providerPath("Dr. Samuel Patel"));
  await p.waitFor(`!!document.querySelector("main [data-linked-entries]")`, 20000).catch(() => {});
  check(
    "a provider with no medications shows no Medications region",
    !(await p.evaluate(`!!document.querySelector("main [data-provider-medications]")`)),
  );
}

// ---------------------------------------------------------------------------
// Slice 3: add, edit, stop, restart and delete.
// ---------------------------------------------------------------------------

const FORM = `document.querySelector("[role=dialog] [data-medication-form]")`;
const formField = (name) => `${FORM}?.querySelector('[name="${name}"]')`;
const TIMES = `[...(${FORM}?.querySelectorAll('input[name="time"]') ?? [])]`;
const FORM_SUBMIT = `${FORM}?.querySelector('button[type="submit"]')`;
/** The error line a form field is described by, or null. */
const errorOf = (name) =>
  `(() => { const el = ${formField(name)}; const id = el?.getAttribute("aria-describedby")?.split(" ").find((x) => x.endsWith("-error")); return id ? (document.getElementById(id)?.textContent.trim() ?? null) : null; })()`;
const TIMES_ERROR = `(${FORM}?.querySelector("[data-schedule-times] > p.text-error")?.textContent.trim() ?? null)`;
const suggestion = (text) =>
  `[...(${FORM}?.querySelectorAll("[data-name-suggestions] button") ?? [])].find((b) => b.textContent.trim() === ${JSON.stringify(text)})`;
const pickerInput = (kind) =>
  `${FORM}?.querySelector('[data-provider-picker="${kind}"] input[role="combobox"]')`;
const pickerChip = (kind) =>
  `(${FORM}?.querySelector('[data-provider-picker="${kind}"] li[data-chip]')?.textContent.trim() ?? null)`;
const option = (text) =>
  `[...document.querySelectorAll('[role="option"]')].find((o) => o.firstElementChild?.textContent === ${JSON.stringify(text)})`;
const OPEN_DIALOG = `document.querySelector("dialog[open]")`;
const dialogButton = (text) =>
  `[...(${OPEN_DIALOG}?.querySelectorAll("button") ?? [])].find((b) => b.textContent.trim() === ${JSON.stringify(text)})`;
/** Every name in one of the list's lists, this run's included. */
const allNames = (label) =>
  `[...document.querySelectorAll('main ul[aria-label="${label}"] [data-medication-name]')].map((n) => n.textContent.trim())`;
const historyTexts = (p) =>
  p.evaluate(
    `[...document.querySelectorAll("main [data-medication-history] li[data-entry-id] [data-entry-text]")].map((t) => t.textContent.trim())`,
  );
const statusOf = (name) =>
  psql(
    `SELECT status || ':' || coalesce(stop_reason, '-') || ':' || coalesce(stop_note, '-') FROM medication WHERE name = '${name}' AND deleted_at IS NULL`,
  );
const changeCount = (name) =>
  psql(
    `SELECT count(*) FROM timeline_entry WHERE kind = 'medicationChange' AND deleted_at IS NULL AND details->>'medicationId' = (SELECT id::text FROM medication WHERE name = '${name}')`,
  );

/** A real tap without scrolling first: a combo box's list closes when the page (or sheet) scrolls. */
async function tapInPlace(p, selector) {
  const point = await p.evaluate(`(() => { const r = ${selector}.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  for (const type of ["mousePressed", "mouseReleased"]) {
    await p.send("Input.dispatchMouseEvent", { type, ...point, button: "left", clickCount: 1 });
  }
}

/**
 * Type into a picker and choose `optionText` from its list. The list closes
 * when the sheet scrolls (React Aria), so scroll first and let it settle,
 * and type again if the list went away before it showed.
 */
async function pickProvider(p, kind, text, optionText) {
  await p.evaluate(`${pickerInput(kind)}.scrollIntoView({ block: "center" })`);
  await sleep(400);
  for (let attempt = 0; attempt < 3; attempt++) {
    await p.evaluate(`${pickerInput(kind)}.focus()`);
    await p.type(pickerInput(kind), "");
    await p.type(pickerInput(kind), text);
    const shown = await p.waitFor(option(optionText), 4000, { quiet: true }).then(
      () => true,
      () => false,
    );
    if (shown) break;
  }
  await tapInPlace(p, option(optionText));
}

/** Open a medication page's ⋯ menu and choose `item`. */
async function pageAction(p, title, item) {
  const button = `document.querySelector('main header [data-region="actions"] button[aria-label=${JSON.stringify(`Actions for ${title}`)}]')`;
  await p.waitFor(button, 15000);
  await p.press(button);
  await p.waitFor(menuItem(item), 5000);
  await p.press(menuItem(item));
}

/** Open the list, wait for it, and open the add sheet from its header (A). */
async function openAddSheet(p) {
  await p.goto(LIST);
  await p.waitFor(`!!document.querySelector("main [data-add-medication]")`, 20000);
  await p.tap(`document.querySelector("main [data-add-medication]")`);
  await p.waitFor(`location.pathname.endsWith("/medications/new") && !!${FORM}`, 15000);
}

/**
 * Add a medication from the add sheet (caretaker@, A): name suggestions,
 * validation on the fields, and a new prescriber added inline, written with
 * it; both show at once, on a second device (B) and on the server, and its
 * page's history says "Started". Returns its name.
 */
async function addSteps(p, B) {
  const name = `${TAG} Losartan`;
  const doctor = `${TAG} Dr. Ada Moss`;
  await openAddSheet(p).then(
    () => check("a writer's Add medication opens the add sheet over the list", true),
    () => check("a writer's Add medication opens the add sheet over the list", false),
  );

  // "lis" suggests the seeded Lisinopril; picking it fills the name only.
  await p.type(formField("name"), "lis");
  await p.waitFor(suggestion("Lisinopril"), 8000).catch(() => {});
  const offered = await p.evaluate(
    `[...(${FORM}?.querySelectorAll("[data-name-suggestions] button") ?? [])].map((b) => b.textContent.trim())`,
  );
  if (offered.includes("Lisinopril")) await p.tap(suggestion("Lisinopril"));
  await sleep(200);
  const filled = await p.evaluate(`({
    name: ${formField("name")}?.value, strength: ${formField("strength")}?.value,
    dose: ${formField("dose")}?.value, reason: ${formField("reason")}?.value,
    suggestions: !!${FORM}?.querySelector("[data-name-suggestions]"),
  })`);
  check(
    'typing "lis" suggests Lisinopril; picking it fills the name only',
    offered.includes("Lisinopril") &&
      filled.name === "Lisinopril" &&
      filled.strength === "" &&
      filled.dose === "" &&
      filled.reason === "" &&
      !filled.suggestions,
    JSON.stringify({ offered, filled }),
  );

  // Validation, through the fields: no name, the same time twice.
  await p.type(formField("name"), "");
  await p.press(`${FORM}.querySelector("[data-add-time]")`);
  await p.type(`${TIMES}[1]`, "08:00");
  await p.press(FORM_SUBMIT);
  await p.waitFor(`${errorOf("name")} !== null`, 8000).catch(() => {});
  const invalid = await p.evaluate(`({ name: ${errorOf("name")}, times: ${TIMES_ERROR},
    focused: document.activeElement === ${formField("name")} })`);
  check(
    "validation shows on the fields: the name is required and each time once (focus on the first)",
    invalid.name === "Enter a name" && invalid.times === "List each time once" && invalid.focused,
    JSON.stringify(invalid),
  );
  // As needed, past the maximum.
  await p.type(formField("name"), name);
  await p.press(`${FORM}.querySelector('input[name="scheduleType"][value="asNeeded"]')`);
  await p.waitFor(formField("maxPerDay"), 5000);
  await p.type(formField("maxPerDay"), "30");
  await p.press(FORM_SUBMIT);
  await p.waitFor(`${errorOf("maxPerDay")} !== null`, 8000).catch(() => {});
  check(
    "an as-needed maximum out of range shows its message",
    (await p.evaluate(errorOf("maxPerDay"))) === "At most 24 a day",
    String(await p.evaluate(errorOf("maxPerDay"))),
  );

  // Fill it in: scheduled at 8:00 and 20:00, with a new prescriber.
  await p.press(`${FORM}.querySelector('input[name="scheduleType"][value="scheduled"]')`);
  await p.waitFor(`${TIMES}.length === 2`, 5000);
  await p.type(`${TIMES}[1]`, "20:00");
  await p.type(formField("strength"), "25 mg");
  await p.evaluate(`${FORM}.querySelector('[name="form"]').value = "tablet"`);
  await p.type(formField("dose"), "1 tablet");
  await p.type(formField("reason"), "Blood pressure");
  await pickProvider(p, "prescriber", doctor, `Add "${doctor}" as a new prescriber`);
  await p
    .waitFor(`${pickerChip("prescriber")} === ${JSON.stringify(`${doctor} (new)`)}`, 5000)
    .catch(() => {});
  const chip = await p.evaluate(pickerChip("prescriber"));
  await p.screenshot("medication-add-sheet");
  await p.press(FORM_SUBMIT);
  const title = `${name} 25 mg`;
  await p
    .waitFor(
      `!${SHEET} && location.pathname.endsWith("/medications") && ${allNames("Current medications")}.includes(${JSON.stringify(title)})`,
      10000,
    )
    .catch(() => {});
  const listed = await p.evaluate(
    `({ path: location.pathname, current: ${allNames("Current medications")} })`,
  );
  check(
    "saving closes the sheet and the medication is on the list at once (current)",
    listed.path.endsWith("/medications") && listed.current.includes(title),
    JSON.stringify({ chip, listed }),
  );
  const server = await waitForSql(
    `SELECT p.name || '|' || p.type || '|' || (m.schedule->>'times') FROM medication m JOIN provider p ON p.id = m.prescriber_id WHERE m.name = '${name}'`,
    (v) => v !== "",
  );
  check(
    "the medication and its new prescriber (a clinician) upload together, linked",
    server === `${doctor}|clinician|["08:00", "20:00"]` && chip === `${doctor} (new)`,
    `${server} / ${chip}`,
  );
  if (B) {
    const seen = await waitForLocal(
      B,
      `SELECT m.name, p.name AS prescriber FROM medication m JOIN provider p ON p.id = m.prescriber_id WHERE m.name = ?`,
      [name],
      (rows) => rows.length === 1,
      30000,
    );
    check(
      "a second device gets the medication and its new prescriber",
      seen[0]?.prescriber === doctor,
      JSON.stringify(seen),
    );
  }
  const id = await medicationId(p, name);
  await p.goto(medPath(id));
  await p
    .waitFor(
      `${onMedPage(id)} && document.querySelectorAll("main [data-medication-history] li").length > 0`,
      20000,
    )
    .catch(() => {});
  const history = await historyTexts(p);
  check('its page\'s history says "Started"', same(history, ["Started"]), JSON.stringify(history));
  return { name, title, id };
}

/**
 * Edit from the medication's page (A): the sheet opens over the list and
 * closes back to the page; a refill edit writes no change entry, a dose
 * change writes one with before and after.
 */
async function editSteps(p, { title, name, id }) {
  const openEdit = async () => {
    await p.goto(medPath(id));
    await p.waitFor(`${onMedPage(id)} && !!document.querySelector("main [data-edit-medication]")`, 20000);
    await p.tap(`document.querySelector("main [data-edit-medication]")`);
    await p.waitFor(`location.pathname.endsWith("/medications/${id}/edit") && !!${FORM}`, 15000);
  };
  await openEdit();
  await p.screenshot("medication-edit-sheet");
  const prefilled = await p.evaluate(`({ name: ${formField("name")}?.value, dose: ${formField("dose")}?.value,
    times: ${TIMES}.map((t) => t.value), prescriber: ${pickerChip("prescriber")},
    status: ${SHEET}?.querySelector("[data-status-now]")?.textContent.trim() })`);
  check(
    "Edit on the page opens the edit sheet, filled in, with the status actions",
    prefilled.name === name &&
      prefilled.dose === "1 tablet" &&
      same(prefilled.times, ["08:00", "20:00"]) &&
      prefilled.prescriber === `${TAG} Dr. Ada Moss` &&
      prefilled.status === "Current: taken now",
    JSON.stringify(prefilled),
  );
  await p.type(formField("refillsLeft"), "3");
  await p.type(formField("quantity"), "30 tablets");
  await p.press(FORM_SUBMIT);
  await p.waitFor(`!${SHEET} && location.pathname.endsWith("/medications/${id}")`, 10000).catch(() => {});
  const back = await p.evaluate(`location.pathname`);
  const refills = await waitForSql(
    `SELECT refills_left FROM medication WHERE id = '${id}'`,
    (v) => v === "3",
  );
  await sleep(500);
  check(
    "saving goes back to the page; a refill edit uploads and writes no change entry",
    back.endsWith(`/medications/${id}`) && refills === "3" && changeCount(name) === "1",
    `${back} refills ${refills}, entries ${changeCount(name)}`,
  );

  await openEdit();
  await p.type(formField("dose"), "2 tablets");
  await p.press(FORM_SUBMIT);
  await p.waitFor(`!${SHEET} && location.pathname.endsWith("/medications/${id}")`, 10000).catch(() => {});
  const changed = await waitForSql(
    `SELECT details->'before'->>'dose' || '>' || (details->'after'->>'dose') FROM timeline_entry WHERE kind = 'medicationChange' AND details->>'change' = 'changed' AND details->>'medicationId' = '${id}'`,
    (v) => v !== "",
  );
  await p
    .waitFor(`document.querySelectorAll("main [data-medication-history] li").length >= 2`, 10000)
    .catch(() => {});
  const history = await historyTexts(p);
  check(
    'changing the dose writes one "Changed" entry with before and after, newest first on the page',
    changed === "1 tablet>2 tablets" &&
      changeCount(name) === "2" &&
      history[0] === "Changed dose 1 tablet → 2 tablets",
    `${changed} ${changeCount(name)} ${JSON.stringify(history)}`,
  );
  void title;
}

/**
 * The status actions on the page (A): Discontinue needs a reason and moves
 * it below the current ones; Restart brings it back ("Resumed"); Mark
 * completed needs no reason; Restart from the edit sheet; Delete.
 */
async function statusSteps(p, { title, name, id }) {
  await p.goto(medPath(id));
  await p.waitFor(onMedPage(id), 20000).catch(() => {});
  await pageAction(p, title, "Discontinue…");
  await p.waitFor(`!!${OPEN_DIALOG}?.querySelector("[data-discontinue-form]")`, 5000).catch(() => {});
  await p.press(dialogButton("Discontinue"));
  await p
    .waitFor(`!!${OPEN_DIALOG}?.querySelector('[role="radiogroup"][aria-invalid="true"]')`, 8000)
    .catch(() => {});
  const refused = await p.evaluate(
    `${OPEN_DIALOG}?.querySelector("[data-discontinue-form] .text-error")?.textContent.trim() ?? null`,
  );
  check(
    "Discontinue without a reason is refused, with the reason's message, and nothing changes",
    refused === "Choose why it was stopped" && statusOf(name).startsWith("current"),
    `${refused} ${statusOf(name)}`,
  );
  await p.press(`${OPEN_DIALOG}.querySelector('input[name="stopReason"][aria-label="Side effects"]')`);
  await p.screenshot("medication-discontinue");
  await p.type(`${OPEN_DIALOG}.querySelector('textarea[name="stopNote"]')`, `${TAG} dizzy`);
  await p.press(dialogButton("Discontinue"));
  await p.waitFor(`!${OPEN_DIALOG}`, 8000).catch(() => {});
  const stopped = await waitForSql(
    `SELECT status || ':' || coalesce(stop_reason, '-') || ':' || coalesce(stop_note, '-') FROM medication WHERE id = '${id}'`,
    (v) => v.startsWith("discontinued"),
  );
  await p
    .waitFor(
      `document.querySelector('main header [data-region="title"] .badge')?.textContent === "Discontinued"`,
      8000,
    )
    .catch(() => {});
  const history = await historyTexts(p);
  check(
    "Discontinue with a reason and a note: the page says so, and its entry is on the history",
    stopped === `discontinued:sideEffects:${TAG} dizzy` && history[0] === "Discontinued: side effects",
    `${stopped} ${JSON.stringify(history.slice(0, 2))}`,
  );
  await p.goto(LIST);
  await p
    .waitFor(
      `${allNames("Completed and discontinued medications")}.includes(${JSON.stringify(title)})`,
      15000,
    )
    .catch(() => {});
  const moved = await p.evaluate(
    `({ current: ${allNames("Current medications")}, stopped: ${allNames("Completed and discontinued medications")} })`,
  );
  check(
    "a discontinued medication moves below the current ones",
    !moved.current.includes(title) && moved.stopped.includes(title),
    JSON.stringify(moved),
  );

  await p.goto(medPath(id));
  await p.waitFor(onMedPage(id), 20000).catch(() => {});
  await pageAction(p, title, "Restart");
  const restarted = await waitForSql(
    `SELECT status FROM medication WHERE id = '${id}'`,
    (v) => v === "current",
  );
  await p
    .waitFor(`!document.querySelector('main header [data-region="title"] .badge')`, 8000)
    .catch(() => {});
  const resumed = await historyTexts(p);
  check(
    'Restart brings it back with a "Resumed" entry',
    restarted === "current" && resumed[0] === "Resumed" && changeCount(name) === "4",
    `${restarted} ${JSON.stringify(resumed.slice(0, 2))} ${changeCount(name)}`,
  );

  await pageAction(p, title, "Mark completed");
  await p.waitFor(dialogButton("Mark completed"), 5000).catch(() => {});
  await p.press(dialogButton("Mark completed"));
  const completed = await waitForSql(
    `SELECT status || ':' || coalesce(stop_reason, '-') || ':' || (stopped_on IS NOT NULL)::text FROM medication WHERE id = '${id}'`,
    (v) => v.startsWith("completed"),
  );
  await p
    .waitFor(
      `document.querySelector('main header [data-region="title"] .badge')?.textContent === "Completed"`,
      8000,
    )
    .catch(() => {});
  check(
    "Mark completed needs no reason; it's dated today",
    completed === "completed:-:true" && (await historyTexts(p))[0] === "Completed",
    completed,
  );

  // The edit sheet's own status actions: Restart there, then back to the page.
  await p.tap(`document.querySelector("main [data-edit-medication]")`);
  await p.waitFor(`!!${SHEET}?.querySelector("[data-status-actions]")`, 15000).catch(() => {});
  const restartButton = `[...(${SHEET}?.querySelectorAll("[data-status-actions] button") ?? [])].find((b) => b.textContent.trim() === "Restart")`;
  await p.press(restartButton);
  await p.waitFor(`!${SHEET} && location.pathname.endsWith("/medications/${id}")`, 10000).catch(() => {});
  const again = await waitForSql(`SELECT status FROM medication WHERE id = '${id}'`, (v) => v === "current");
  check(
    "Restart in the edit sheet works too, and closes back to the page",
    again === "current" && (await p.evaluate(`location.pathname`)).endsWith(`/medications/${id}`),
    again,
  );

  // Delete: a confirm, then the list; it's gone from it, soft.
  await pageAction(p, title, "Delete");
  await p.waitFor(dialogButton("Delete"), 5000).catch(() => {});
  await p.press(dialogButton("Delete"));
  await p
    .waitFor(
      `location.pathname.endsWith("/medications") && ${allNames("Current medications")}.length >= 4`,
      10000,
    )
    .catch(() => {});
  const deleted = await waitForSql(
    `SELECT (deleted_at IS NOT NULL)::text FROM medication WHERE id = '${id}'`,
    (v) => v === "true",
  );
  const after = await p.evaluate(
    `({ path: location.pathname, all: [...${allNames("Current medications")}, ...${allNames("Completed and discontinued medications")}] })`,
  );
  check(
    "Delete asks first, then goes to the list without it; the delete is soft and uploads",
    deleted === "true" && after.path.endsWith("/medications") && !after.all.includes(title),
    JSON.stringify(after),
  );
}

/** Offline (A, through its proxy): add, edit and discontinue; each syncs on reconnecting with one change entry (B sees it). */
async function formOfflineSteps(p, proxy, B) {
  const name = `${TAG} Albuterol`;
  await p.goto(LIST);
  await p.waitFor(`${allNames("Current medications")}.length >= 4`, 20000).catch(() => {});
  const errorsBefore = p.errors.length;
  proxy.setOnline(false);
  await p.waitFor(`!window.caretookSync.powersync.currentStatus.connected`, 15000).catch(() => {});
  await p.tap(`document.querySelector("main [data-add-medication]")`);
  await p.waitFor(`!!${FORM}`, 15000).catch(() => {});
  await p.type(formField("name"), name);
  await p.press(`${FORM}.querySelector('input[name="scheduleType"][value="asNeeded"]')`);
  await p.waitFor(formField("maxPerDay"), 5000);
  await p.type(formField("maxPerDay"), "4");
  await p.type(formField("dose"), "1 puff");
  await p.press(FORM_SUBMIT);
  await p
    .waitFor(`!${SHEET} && ${allNames("Current medications")}.includes(${JSON.stringify(name)})`, 10000)
    .catch(() => {});
  const added = await p.evaluate(`${allNames("Current medications")}.includes(${JSON.stringify(name)})`);
  const id = await medicationId(p, name);
  // A full load needs the network (no service worker yet): open its page from the list.
  await p.tap(`document.querySelector('main li[data-medication-id="${id}"] [data-medication-name]')`);
  await p.waitFor(onMedPage(id), 10000).catch(() => {});
  await p.tap(`document.querySelector("main [data-edit-medication]")`);
  await p.waitFor(`!!${FORM}`, 10000).catch(() => {});
  await p.type(formField("dose"), "2 puffs");
  await p.press(FORM_SUBMIT);
  await p.waitFor(`!${SHEET} && location.pathname.endsWith("/medications/${id}")`, 10000).catch(() => {});
  await pageAction(p, name, "Discontinue…");
  await p.waitFor(`!!${OPEN_DIALOG}?.querySelector("[data-discontinue-form]")`, 5000).catch(() => {});
  await p.press(`${OPEN_DIALOG}.querySelector('input[name="stopReason"][aria-label="Not working"]')`);
  await p.press(dialogButton("Discontinue"));
  await p.waitFor(`!${OPEN_DIALOG}`, 8000).catch(() => {});
  const local = await localRows(
    p,
    `SELECT m.status, m.dose, (SELECT count(*) FROM timeline_entry e WHERE e.kind = 'medicationChange' AND json_extract(e.details, '$.medicationId') = m.id) AS n FROM medication m WHERE m.id = ?`,
    [id],
  );
  const before = psql(`SELECT count(*) FROM medication WHERE name = '${name}'`);
  proxy.setOnline(true);
  await p.waitFor(`window.caretookSync.powersync.currentStatus.connected`, 30000).catch(() => {});
  const synced = await waitForSql(
    `SELECT status || ':' || dose || ':' || stop_reason FROM medication WHERE name = '${name}'`,
    (v) => v === "discontinued:2 puffs:ineffective",
    30000,
  );
  const kinds = await waitForSql(
    `SELECT string_agg(details->>'change', ',' ORDER BY occurred_at) FROM timeline_entry WHERE kind = 'medicationChange' AND details->>'medicationId' = '${id}'`,
    (v) => v.split(",").length >= 3,
  );
  check(
    "offline: add, edit and discontinue work on the device, then sync on reconnecting with one change entry each",
    added &&
      local[0]?.status === "discontinued" &&
      local[0]?.n === 3 &&
      before === "0" &&
      synced === "discontinued:2 puffs:ineffective" &&
      kinds === "started,changed,stopped",
    `${added} ${JSON.stringify(local)} ${before} ${synced} ${kinds}`,
  );
  if (B) {
    const seen = await waitForLocal(
      B,
      "SELECT status FROM medication WHERE id = ?",
      [id],
      (r) => r[0]?.status === "discontinued",
      30000,
    );
    check("…and a second device gets it", seen[0]?.status === "discontinued", JSON.stringify(seen));
  }
  p.errors.splice(errorsBefore); // Offline fetch failures aren't the app's errors.
}

/** viewer@ (C): no add, edit or status controls; the sheet URLs show the list with no form. */
async function viewerFormSteps(C) {
  await C.goto(LIST);
  await C.waitFor(`${allNames("Current medications")}.length >= 4`, 20000).catch(() => {});
  const add = await C.evaluate(`!!document.querySelector("main [data-add-medication]")`);
  await C.goto(`${LIST}/new?q=lis`);
  await C.waitFor(
    `location.pathname.endsWith("/medications") && ${allNames("Current medications")}.length >= 1`,
    20000,
  ).catch(() => {});
  const fromNew = await C.evaluate(
    `({ path: location.pathname, search: location.search, form: !!document.querySelector("[data-medication-form]") })`,
  );
  const lisinopril = await medicationId(C, "Lisinopril");
  await C.goto(`${LIST}/${lisinopril}/edit`);
  await C.waitFor(
    `location.pathname.endsWith("/medications") && ${allNames("Current medications")}.length >= 4`,
    20000,
  ).catch(() => {});
  const fromEdit = await C.evaluate(
    `({ path: location.pathname, form: !!document.querySelector("[data-medication-form]") })`,
  );
  await C.goto(medPath(lisinopril));
  await C.waitFor(onMedPage(lisinopril), 20000).catch(() => {});
  const page = await C.evaluate(
    `({ actions: !!document.querySelector('main header [data-region="actions"]'), edit: !!document.querySelector("[data-edit-medication]") })`,
  );
  check(
    "a viewer gets no Add, Edit or status controls, and the sheet URLs show the list with no form",
    !add &&
      fromNew.path.endsWith("/medications") &&
      fromNew.search === "?q=lis" &&
      !fromNew.form &&
      fromEdit.path.endsWith("/medications") &&
      !fromEdit.form &&
      !page.actions &&
      !page.edit,
    JSON.stringify({ add, fromNew, fromEdit, page }),
  );
}

// One proxy for caretaker@'s browser, shared by the list's, the print sheet's and the timeline's offline steps.
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
  await seedSteps(A);
  const made = await writeSteps(A);
  await listSteps(A);
  await pageSteps(A);
  await printSteps(A);
  await providerMedicationSteps(A);
  // Slice 3 on A; the second device (B) only in a full run.
  if (SMOKE) await addSteps(A);

  if (!SMOKE) {
    // member@ is in both groups: each group's medications stay its own.
    const B = await openPage(bB, "member");
    pages.push(B);
    await B.signIn("member@example.com", PW);
    const second = await waitForLocal(
      B,
      "SELECT name, group_id FROM medication WHERE group_id = ?",
      [DEV_FAMILY_2],
      (rows) => rows.length >= 1,
    );
    const [zone] = await localRows(
      B,
      "SELECT time_zone, date_of_birth FROM care_recipient WHERE group_id = ?",
      [DEV_FAMILY_2],
    );
    check(
      "member@ has Dev Family 2's one medication and its recipient's zone and date of birth, apart from Dev Family's",
      second.length === 1 &&
        second[0].name === "Tamsulosin" &&
        zone?.time_zone === "America/Los_Angeles" &&
        zone?.date_of_birth === "1938-07-02",
      JSON.stringify({ second, zone }),
    );
    const notesId = await notesSteps(A, B);
    const added = await addSteps(A, B);
    if (added.id) {
      await editSteps(A, added);
      await statusSteps(A, added);
    }
    await formOfflineSteps(A, proxy, B);
    await offlineSteps(A, proxy);
    await printOfflineSteps(A, proxy);
    if (made) {
      const synced = await waitForLocal(
        B,
        "SELECT dose, status FROM medication WHERE id = ?",
        [made],
        (rows) => rows[0]?.dose === "2 tablets" && rows[0]?.status === "current",
      );
      const entries = await waitForLocal(
        B,
        "SELECT id FROM timeline_entry WHERE kind = 'medicationChange' AND json_extract(details, '$.medicationId') = ?",
        [made],
        (rows) => rows.length >= 4,
      );
      check(
        "a second device gets the new medication and its four change entries",
        synced[0]?.dose === "2 tablets" && entries.length === 4,
        `${JSON.stringify(synced)} ${entries.length} entries`,
      );
    }

    // viewer@: reads everything, writes nothing.
    const C = await openPage(bC, "viewer");
    pages.push(C);
    await C.signIn("viewer@example.com", PW);
    const seen = await waitForLocal(
      C,
      "SELECT id FROM medication WHERE group_id = ? AND deleted_at IS NULL",
      [DEV_FAMILY],
      (rows) => rows.length >= 6,
    );
    const lisinopril = (
      await localRows(C, "SELECT id FROM medication WHERE name = 'Lisinopril' AND group_id = ?", [DEV_FAMILY])
    )[0]?.id;
    const refusals = await onDevice(
      C,
      `const id = ${JSON.stringify(lisinopril)};
       return [
         await medications.createMedication(db, ${JSON.stringify(DEV_FAMILY)}, { name: "Nope", schedule: { type: "asNeeded" } }),
         await medications.updateMedication(db, id, { dose: "9 tablets" }),
         await medications.removeMedication(db, id),
         await medications.logDose(db, ${JSON.stringify(DEV_FAMILY)}, { medicationId: id, status: "given" }),
       ].map((r) => r.ok);`,
    );
    const untouched = await localRows(C, "SELECT dose, deleted_at FROM medication WHERE id = ?", [
      lisinopril,
    ]);
    check(
      "a viewer's device has the medications, and refuses every write",
      seen.length >= 6 &&
        refusals.every((ok) => ok === false) &&
        untouched[0]?.dose === "1 tablet" &&
        !untouched[0]?.deleted_at,
      JSON.stringify(refusals),
    );
    await viewerSteps(C, notesId);
    await viewerFormSteps(C);
    await notFoundSteps(B, A);
  }

  if (SMOKE) await timelineSteps(A);
  else await timelineSteps(A, { B: pages[1], C: pages[2], proxyA });

  if (made) {
    const removed = await onDevice(A, `return medications.removeMedication(db, ${JSON.stringify(made)});`);
    const gone = await waitForSql(
      `SELECT (deleted_at IS NOT NULL)::text FROM medication WHERE id = '${made}'`,
      (v) => v === "true",
    );
    const listed = await onDevice(
      A,
      `const q = medications.medicationsQuery(${JSON.stringify(DEV_FAMILY)});
       return (await db.powersync.getAll(q.sql, q.params)).some((m) => m.id === ${JSON.stringify(made)});`,
    );
    const kept = psql(`${CHANGES_SQL(made)} AND deleted_at IS NULL`);
    check(
      "deleting the medication is soft, uploads, leaves the list, and keeps its change entries",
      removed.ok && gone === "true" && listed === false && kept === "4",
      `${gone} ${listed} ${kept}`,
    );
  }

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
       UPDATE medication SET deleted_at = now() WHERE deleted_at IS NULL AND name LIKE '${TAG}%';
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
