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
// - a viewer's device writes are refused locally;
// - the timeline still shows no dose or medication-change rows.
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

  const shown = await p.evaluate(`document.querySelectorAll("main ol > li").length`);
  const text = await p.evaluate(`document.querySelector("main")?.innerText ?? ""`);
  check(
    "the timeline still renders, with no dose or medication-change rows",
    shown > 0 && !/Lisinopril|Metformin|medicationChange/.test(text),
    `${shown} rows`,
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
    bar.labels === "Timeline,Providers,Medications" && bar.current === "Timeline",
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
    wide.labels === "Timeline,Providers,Medications" && wide.current === "Medications",
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
    "the seeded notes show in the editor, writable for a caretaker; no edit controls yet",
    seeded.notes?.includes("applesauce") && seeded.editable === "true" && !seeded.actions,
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

const proxy = startProxy(9434);
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
    await offlineSteps(A, proxy);
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
    await notFoundSteps(B, A);
  }

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

  const noise = /401|Failed to load resource|\[PowerSync\]: Sync aborted/;
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
       UPDATE medication SET deleted_at = now() WHERE deleted_at IS NULL AND name LIKE '${TAG}%'`,
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
