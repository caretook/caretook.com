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
// Later slices add their screens' steps here. Every medication this run makes
// carries its tag and is soft-deleted at the end, with its entries, so it
// passes run after run without a reset. SMOKE=1 runs caretaker@'s path only.
import { execSync } from "node:child_process";
import { launch, openPage, sleep, SMOKE } from "./cdp.mjs";

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

const bA = await launch(9431);
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
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
