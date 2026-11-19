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
// Later slices add their screens' steps here. Every medication this run makes
// carries its tag and is soft-deleted at the end, with its entries, so it
// passes run after run without a reset. SMOKE=1 runs caretaker@'s path only.
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
const BAR = `document.querySelector('[aria-label="Add to the timeline"]')`;
const tile = (text) =>
  `[...(${BAR}?.querySelectorAll("a, button") ?? [])].find((b) => b.textContent.trim() === ${JSON.stringify(text)})`;
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
  const timeline = await A.evaluate("location.pathname");
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
    `[...(${BAR}?.querySelectorAll("a, button") ?? [])].map((b) => b.textContent.trim()).join(",")`,
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
    const viewerTimeline = await C.evaluate("location.pathname");
    await C.goto(`${viewerTimeline}?kind=dose`);
    await C.waitFor(`${ROWS}.length > 0 && document.querySelector("[data-medication]")`, 20000).catch(
      () => undefined,
    );
    const state = await C.evaluate(
      `JSON.stringify({ bar: !!${BAR}, opens: !!document.querySelector('main ol a[aria-label^="Edit "], main ol a[aria-label^="Open "]'), menus: !!document.querySelector('main ol button[aria-label^="Actions"]'), rows: ${ROWS}.length })`,
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

const proxyA = startProxy(9441);
const bA = await launch(9431, proxyA.args);
const bB = SMOKE ? null : await launch(9432);
const bC = SMOKE ? null : await launch(9433);
const pages = [];

try {
  const A = await openPage(bA, "caretaker");
  pages.push(A);
  await A.signIn("caretaker@example.com", PW);
  await seedSteps(A);
  const made = await writeSteps(A);

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
       UPDATE medication SET deleted_at = now() WHERE deleted_at IS NULL AND name LIKE '${TAG}%'`,
    );
  } catch (e) {
    console.log(`clean-up failed: ${e.message}`);
  }
  for (const p of pages) p.close();
  for (const b of [bA, bB, bC]) b?.proc.kill();
  proxyA.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
