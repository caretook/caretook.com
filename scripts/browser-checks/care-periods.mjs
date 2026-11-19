// Care periods (care-periods PRD), slice 1: the data layer through the
// device module (lib/sync/carePeriods.ts, via `window.caretookModules()`
// against `window.caretookSync`), the periods page and its add sheet, and a
// period's minimal page.
//
// - the seeded track (Home, Emergency room, Hospital at Mercy General with a
//   room, Rehab, Home) reaches a signed-in device and lists newest first,
//   the current one marked Now;
// - a writer adds a period from the periods page, typing a new place in the
//   picker: the sheet closes, the period is listed at once as current, the
//   place is a new provider written with it, and the period before now ends;
// - a second device gets it within seconds;
// - an earlier, date-only period (from the add sheet's prefills) slots into
//   the track by its start, with no time shown, and its neighbour's end moves;
// - Other needs a label (a field message); a future start is refused;
// - offline, a period added in the sheet is listed at once and uploads on
//   reconnect; a second device's period with the same start stays too, in
//   (started_at, created_at, id) order on both devices;
// - viewer@ sees the list without "Add period", `periods/new` sends them to
//   the list, and their device refuses writes;
// - a period's page shows its type, place and dates; another group's or a
//   missing period is the 404.
//
// Every period this run makes carries its tag (in its label) and is
// soft-deleted at the end, with any place it added, so it passes run after
// run without a reset. SMOKE=1: the seeded list, and adding a period.
//
// Slice 5 (suggestions from events): an event titled "Admitted to Mercy
// General" offers "Start a hospital period?"; the chip opens the add sheet
// with the type, the event's time and its linked practice, and saving
// returns to the entry with the chip gone; no chip when the period at that
// time already has the type, on a note, or for a viewer; offline, a renamed
// event's chip follows and its sheet opens.
import { execSync } from "node:child_process";
import { launch, openPage, sleep, step, SMOKE } from "./cdp.mjs";
import { startProxy } from "./proxy.mjs";

const PG_CONTAINER = process.env.PG_CONTAINER ?? "caretook-postgres-1";
const PW = process.env.SEED_USER_PASSWORD ?? "caretook-dev-password";
const DEV_FAMILY = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";
const DEV_FAMILY_2 = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8d0001";
const SEEDED_HOSPITAL = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2bc11003";
const TAG = `CP-${Date.now().toString(36)}`;
const LA = "America/Los_Angeles";

const PERIODS = `/app/groups/${DEV_FAMILY}/periods`;

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

const DEVICE_MS = 20000;
/** Run `body` in the page with the local database as `db` and the device module as `periods`. */
const onDevice = (p, body) =>
  Promise.race([
    p.evaluate(`(async () => {
    const db = window.caretookSync;
    if (!db) throw new Error("window.caretookSync isn't there (dev and check builds only)");
    const { carePeriods: periods } = await window.caretookModules();
    ${body}
  })()`),
    sleep(DEVICE_MS).then(() => {
      throw new Error(`a device call didn't answer in ${DEVICE_MS / 1000} s: ${body.trim().slice(0, 120)}`);
    }),
  ]);
const localRows = (p, sql, params = []) =>
  onDevice(p, `return db.powersync.getAll(${JSON.stringify(sql)}, ${JSON.stringify(params)});`);
const waitForLocal = async (p, sql, params, test, ms = 20000) => {
  const end = Date.now() + ms;
  let rows = [];
  while (Date.now() < end) {
    rows = await localRows(p, sql, params).catch(() => []);
    if (test(rows)) return rows;
    await sleep(300);
  }
  return rows;
};
const need = async (p, expression, ms, what) => {
  const ok = await p.waitFor(expression, ms, { quiet: true }).then(
    () => true,
    () => false,
  );
  if (!ok) console.log(`WAIT  ${what}: not within ${ms / 1000} s\n${await p.diagnose()}`);
  return ok;
};
const toFront = (p) => p.send("Page.bringToFront");

/** The first instant of the day `daysAgo` days back in Los Angeles, as ISO. */
const laMidnight = (daysAgo) => {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: LA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() - daysAgo * 86_400_000));
  // Los Angeles is UTC-8 or UTC-7: find the offset that lands on midnight there.
  for (const offset of [8, 7]) {
    const at = new Date(`${day}T${String(offset).padStart(2, "0")}:00:00.000Z`);
    const local = new Intl.DateTimeFormat("en-GB", {
      timeZone: LA,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(at);
    if (local === "00") return at.toISOString();
  }
  throw new Error(`no midnight for ${day}`);
};

// The periods page.
const LIST = `document.querySelector("main [data-period-list]")`;
const rowsState = (p) =>
  p.evaluate(`[...document.querySelectorAll("main [data-period-list] > li")].map((li) => ({
    id: li.dataset.period,
    current: li.dataset.current === "true",
    title: li.querySelector("[data-period-title]")?.textContent.trim(),
    place: li.querySelector("[data-period-place]")?.textContent.trim() ?? null,
    dates: li.querySelector("[data-period-dates]")?.textContent.trim(),
  }))`);
const ADD = `document.querySelector("main a[data-add-period]")`;
const FORM = `document.querySelector("[role=dialog] [data-period-form]")`;
const SHEET = `document.querySelector("[role=dialog]")`;
const formField = (name) => `${FORM}?.querySelector('[name="${name}"]')`;
const typeRadio = (label) =>
  `${FORM}?.querySelector('input[name="type"][aria-label=${JSON.stringify(label)}]')`;
const SUBMIT = `${FORM}?.querySelector('button[type="submit"]')`;
const errorOf = (name) =>
  `(() => { const el = ${formField(name)}; const id = el?.getAttribute("aria-describedby")?.split(" ").find((x) => x.endsWith("-error")); return id ? (document.getElementById(id)?.textContent.trim() ?? null) : null; })()`;
const PICKER = `${FORM}?.querySelector('[data-place-picker] input[role="combobox"]')`;
const PICKER_CHIP = `(${FORM}?.querySelector('[data-place-picker] li[data-chip]')?.textContent.trim() ?? null)`;
const option = (text) =>
  `[...document.querySelectorAll('[role="option"]')].find((o) => o.firstElementChild?.textContent === ${JSON.stringify(text)})`;
const NOT_FOUND = `document.querySelector("main h1")?.textContent === "Not found"`;

/** A real tap without scrolling first: a combo box's list closes when the sheet scrolls. */
async function tapInPlace(p, selector) {
  const point = await p.evaluate(`(() => { const r = ${selector}.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  for (const type of ["mousePressed", "mouseReleased"]) {
    await p.send("Input.dispatchMouseEvent", { type, ...point, button: "left", clickCount: 1 });
  }
}

async function pickPlace(p, text, optionText) {
  await p.evaluate(`${PICKER}.scrollIntoView({ block: "center" })`);
  await sleep(400);
  for (let attempt = 0; attempt < 3; attempt++) {
    await p.evaluate(`${PICKER}.focus()`);
    await p.type(PICKER, "");
    await p.type(PICKER, text);
    const shown = await p.waitFor(option(optionText), 4000, { quiet: true }).then(
      () => true,
      () => false,
    );
    if (shown) break;
  }
  await tapInPlace(p, option(optionText));
}

async function openList(p) {
  await p.goto(PERIODS);
  return need(p, `${LIST} || document.querySelector("main [data-periods-empty]")`, 20000, "the periods page");
}

/** The seeded track on the device, and the periods page listing it newest first. */
async function seedSteps(p) {
  const local = await waitForLocal(
    p,
    "SELECT id, type, date_only FROM care_period WHERE group_id = ? AND deleted_at IS NULL ORDER BY started_at, created_at, id",
    [DEV_FAMILY],
    (rows) => rows.length >= 5,
  );
  const doc = await localRows(p, "SELECT subject, care_period_id FROM note_document WHERE id = ?", [
    SEEDED_HOSPITAL,
  ]);
  const seeded = local.filter((r) => r.id.startsWith("0b6f3c1e-5d1a-4c2e-9a77-3f1d2bc1"));
  check(
    "the seeded track reaches the device in order, with the hospital stay's notes (subject carePeriod)",
    seeded.map((r) => r.type).join(",") === "home,emergency,hospital,rehab,home" &&
      seeded[0].date_only === 1 &&
      doc[0]?.subject === "carePeriod" &&
      doc[0]?.care_period_id === SEEDED_HOSPITAL,
    JSON.stringify({ seeded: seeded.map((r) => r.type), doc }),
  );

  await openList(p);
  await need(p, `document.querySelectorAll("main [data-period-list] > li").length >= 5`, 15000, "the list");
  const rows = (await rowsState(p)).filter((r) => r.id.startsWith("0b6f3c1e-5d1a-4c2e-9a77-3f1d2bc1"));
  const hospital = rows.find((r) => r.id === SEEDED_HOSPITAL);
  const all = await rowsState(p);
  check(
    "the periods page lists the track newest first; the latest is marked Now; the hospital shows its place and room",
    rows.map((r) => r.title).join(" | ") ===
      "Home | Rehab · Oak Hills Rehab | Hospital · Cardiac unit (4 West) | Emergency room · Mercy General ER | Home" &&
      all[0].current &&
      all.filter((r) => r.current).length === 1 &&
      hospital?.place === "Mercy General Hospital, Room 412, bed B" &&
      /until/.test(hospital?.dates ?? ""),
    JSON.stringify(rows.map((r) => [r.title, r.place, r.dates])),
  );
}

/** Add a period from the periods page, with a new place typed in the picker. */
async function addSteps(p) {
  await toFront(p);
  await openList(p);
  const before = await rowsState(p);
  await p.tap(ADD);
  const opened = await need(
    p,
    `${FORM} && location.pathname.endsWith("/periods/new")`,
    10000,
    "the add sheet",
  );
  check("a writer's Add period opens the add sheet over the list", opened);

  // Other with no label: the field says so.
  await p.press(typeRadio("Other"));
  await p.press(SUBMIT);
  await need(p, `${errorOf("label")} !== null`, 8000, "the label's error");
  const otherError = await p.evaluate(errorOf("label"));
  check("Other needs a label: the field says so", otherError === "Say what this is", String(otherError));

  await p.press(typeRadio("Hospital"));
  await p.type(formField("label"), `${TAG} ward`);
  const place = `${TAG} General`;
  await pickPlace(p, place, `Add "${place}" as a new place`);
  await need(p, `${PICKER_CHIP} === ${JSON.stringify(`${place} (new)`)}`, 5000, "the new place's chip");
  await p.type(formField("placeDetail"), "Room 7");
  await p.screenshot("care-period-add-sheet");
  await p.press(SUBMIT);
  await need(
    p,
    `!${SHEET} && location.pathname.endsWith("/periods") && document.querySelector("main [data-period-list] > li")?.querySelector("[data-period-title]")?.textContent.includes(${JSON.stringify(TAG)})`,
    10000,
    "the sheet to close and the new period to be listed first",
  );
  const after = await rowsState(p);
  const [top, previous] = after;
  check(
    "saving closes the sheet; the new period is listed first as current, with its new place and room",
    top?.title === `Hospital · ${TAG} ward` &&
      top.current &&
      top.place === `${place}, Room 7` &&
      /now/.test(top.dates),
    JSON.stringify(top),
  );
  check(
    "the period that was current now ends",
    previous?.id === before[0]?.id && !previous.current && /until/.test(previous.dates),
    JSON.stringify({ before: before[0], previous }),
  );
  const server = await waitForSql(
    `SELECT cp.type || '|' || cp.place_detail || '|' || pr.type || '|' || pr.name FROM care_period cp JOIN provider pr ON pr.id = cp.place_provider_id WHERE cp.label = '${TAG} ward' AND cp.deleted_at IS NULL`,
    (v) => v !== "",
  );
  check(
    "it uploads, with the new place as a practice in the directory",
    server === `hospital|Room 7|practice|${place}`,
    server,
  );
  return top?.id ?? null;
}

/** An earlier, date-only period from the sheet's prefills slots into the track. */
async function earlierSteps(p) {
  const start = laMidnight(3);
  await toFront(p);
  await p.goto(`${PERIODS}/new?type=rehab&startedAt=${encodeURIComponent(start)}&dateOnly=1`);
  await need(p, `${FORM}`, 15000, "the add sheet with prefills");
  const prefilled = await p.evaluate(`({
    rehab: ${typeRadio("Rehab or skilled nursing")}?.checked,
    dateOnly: ${formField("dateOnly")}?.checked,
  })`);
  check(
    "the add sheet starts from its URL's type and date-only prefills",
    prefilled.rehab && prefilled.dateOnly,
    JSON.stringify(prefilled),
  );
  await p.type(formField("label"), `${TAG} rehab`);
  await p.press(SUBMIT);
  // Deep-linked: closing replaces it with the list.
  await need(p, `!${SHEET} && location.pathname.endsWith("/periods")`, 10000, "the sheet to close");
  await need(
    p,
    `[...document.querySelectorAll("main [data-period-title]")].some((t) => t.textContent.includes(${JSON.stringify(`${TAG} rehab`)}))`,
    10000,
    "the earlier period to be listed",
  );
  const rows = await rowsState(p);
  const i = rows.findIndex((r) => r.title?.includes(`${TAG} rehab`));
  const row = rows[i];
  const older = rows[i + 1];
  const startDay = new Intl.DateTimeFormat("en-US", { timeZone: LA, month: "short", day: "numeric" }).format(
    new Date(start),
  );
  check(
    "an earlier date-only period slots in by its start: no time shown, and the period before it now ends that day",
    i > 0 &&
      !row.current &&
      !/\d:\d/.test(row.dates.split("–")[0]) &&
      older?.dates.includes(`until ${startDay}`) &&
      (await waitForSql(
        `SELECT date_only::text || '|' || to_char(started_at AT TIME ZONE 'America/Los_Angeles', 'HH24:MI') FROM care_period WHERE label = '${TAG} rehab'`,
        (v) => v === "true|00:00",
      )) === "true|00:00",
    JSON.stringify({ i, row, older, startDay }),
  );

  // The device refuses a future start.
  const future = await onDevice(
    p,
    `return periods.createCarePeriod(db, ${JSON.stringify(DEV_FAMILY)}, { type: "home", startedAt: new Date(Date.now() + 86400000).toISOString() });`,
  );
  check(
    "the device refuses a future start, on startedAt",
    future.ok === false &&
      future.issues?.[0]?.path === "startedAt" &&
      future.issues[0].message === "Can't be in the future",
    JSON.stringify(future),
  );
}

/** A second device sees a new period within seconds. */
async function secondDeviceSteps(B, id) {
  const seen = await waitForLocal(
    B,
    "SELECT id FROM care_period WHERE id = ?",
    [id],
    (rows) => rows.length === 1,
    15000,
  );
  await openList(B);
  const listed = await need(
    B,
    `!!document.querySelector('main [data-period="${id}"]')`,
    10000,
    "the period on B's list",
  );
  check("a second device gets the new period within seconds, and lists it", seen.length === 1 && listed);
}

/** Offline add in the sheet, and two periods with the same start from two devices. */
async function offlineSteps(A, proxy, B) {
  const start = laMidnight(1);
  const errorsBefore = A.errors.length;
  await toFront(A);
  // Open the sheet (prefilled with B's start below) while online: a full load can't happen offline on the web.
  await A.goto(`${PERIODS}/new?type=home&startedAt=${encodeURIComponent(start)}&dateOnly=1`);
  await need(A, `${FORM}`, 15000, "the prefilled sheet");
  proxy.setOnline(false);
  await A.waitFor(`!window.caretookSync.powersync.currentStatus.connected`, 15000).catch(() => {});
  await A.type(formField("label"), `${TAG} tie A`);
  await A.press(SUBMIT);
  const listed = await need(
    A,
    `!${SHEET} && [...document.querySelectorAll("main [data-period-title]")].some((t) => t.textContent.includes(${JSON.stringify(`${TAG} tie A`)}))`,
    10000,
    "the offline period listed",
  );
  check("offline: a period added in the sheet is listed at once", listed);

  // B adds one with the same start while A is offline.
  const fromB = await onDevice(
    B,
    `return periods.createCarePeriod(db, ${JSON.stringify(DEV_FAMILY)}, { type: "emergency", label: ${JSON.stringify(`${TAG} tie B`)}, startedAt: ${JSON.stringify(start)}, dateOnly: true });`,
  );
  proxy.setOnline(true);
  await A.waitFor(`window.caretookSync.powersync.currentStatus.connected`, 30000).catch(() => {});
  const server = await waitForSql(
    `SELECT count(*) FROM care_period WHERE label IN ('${TAG} tie A', '${TAG} tie B') AND deleted_at IS NULL`,
    (v) => v === "2",
    30000,
  );
  check(
    "offline: it uploads on reconnect, and the other device's period with the same start stays too",
    fromB.ok && server === "2",
    `${JSON.stringify(fromB)} ${server}`,
  );

  const order = psql(
    `SELECT string_agg(label, ',' ORDER BY started_at, created_at, id) FROM care_period WHERE label IN ('${TAG} tie A', '${TAG} tie B')`,
  );
  const orderSql =
    "SELECT label FROM care_period WHERE label LIKE ? AND deleted_at IS NULL ORDER BY started_at, created_at, id";
  const onA = await waitForLocal(A, orderSql, [`${TAG} tie%`], (rows) => rows.length === 2);
  const onB = await waitForLocal(B, orderSql, [`${TAG} tie%`], (rows) => rows.length === 2);
  const rows = await rowsState(A);
  const shown = rows.filter((r) => r.title?.includes(`${TAG} tie`)).map((r) => r.title.split(" · ")[1]);
  check(
    "both devices order the tie the same way (started_at, created_at, id), and the page shows both",
    onA.map((r) => r.label).join(",") === order &&
      onB.map((r) => r.label).join(",") === order &&
      shown.length === 2 &&
      shown.reverse().join(",") === order,
    JSON.stringify({ order, onA, onB, shown }),
  );
  A.errors.splice(errorsBefore); // Offline fetch failures aren't the app's errors.
}

/** viewer@: the list without Add, `periods/new` goes to the list, and the device refuses writes. */
async function viewerSteps(C) {
  await openList(C);
  await need(
    C,
    `document.querySelectorAll("main [data-period-list] > li").length >= 5`,
    20000,
    "the viewer's list",
  );
  const state = await C.evaluate(
    `({ add: !!${ADD}, rows: document.querySelectorAll("main [data-period-list] > li").length })`,
  );
  await C.goto(`${PERIODS}/new`);
  await need(C, `location.pathname.endsWith("/periods") && ${LIST}`, 15000, "the viewer's redirect");
  const path = await C.evaluate("location.pathname");
  const refused = await onDevice(
    C,
    `return [
      await periods.createCarePeriod(db, ${JSON.stringify(DEV_FAMILY)}, { type: "home", startedAt: new Date().toISOString() }),
      await periods.updateCarePeriod(db, ${JSON.stringify(SEEDED_HOSPITAL)}, { label: "Nope" }),
      await periods.removeCarePeriod(db, ${JSON.stringify(SEEDED_HOSPITAL)}),
    ].map((r) => r.ok);`,
  );
  check(
    "a viewer sees the list without Add period, periods/new goes to the list, and their device refuses writes",
    !state.add && state.rows >= 5 && path.endsWith("/periods") && refused.every((ok) => ok === false),
    JSON.stringify({ state, path, refused }),
  );
}

/** A period's page, and the 404s. */
async function pageSteps(p, member) {
  await toFront(p);
  await p.goto(`${PERIODS}/${SEEDED_HOSPITAL}`);
  await need(p, `document.querySelector("main [data-period-page]")`, 30000, "the period page");
  const page = await p.evaluate(`({
    h1: document.querySelector("main h1")?.textContent.trim(),
    place: document.querySelector("main [data-period-place]")?.textContent.trim(),
    placeLink: document.querySelector("main [data-period-place] a")?.getAttribute("href"),
    start: document.querySelector("main [data-period-start]")?.textContent.trim(),
    end: document.querySelector("main [data-period-end]")?.textContent.trim(),
  })`);
  check(
    "a period's page shows its type, label, place (a link to the provider), start and end",
    page.h1 === "Hospital · Cardiac unit (4 West)" &&
      page.place === "Mercy General Hospital, Room 412, bed B" &&
      /\/providers\//.test(page.placeLink ?? "") &&
      /\d\d:\d\d/.test(page.start ?? "") &&
      !!page.end &&
      !page.end.startsWith("Now"),
    JSON.stringify(page),
  );
  if (!member) return;
  // Dev Family's period under Dev Family 2 (member@ is in both), and a missing id.
  await member.goto(`/app/groups/${DEV_FAMILY_2}/periods/${SEEDED_HOSPITAL}`);
  await need(member, NOT_FOUND, 15000, "the other group's 404");
  const leaks = await member.evaluate(`document.querySelector("main")?.textContent.includes("Cardiac")`);
  await member.goto(`${PERIODS}/0b6f3c1e-5d1a-4c2e-9a77-000000000000`);
  const missing = await need(member, NOT_FOUND, 15000, "the missing period's 404");
  check(
    "another group's and a missing period's URL is the 404, with no names",
    !leaks && missing,
    String(leaks),
  );
}

// Slice 5: suggestions from events, on the entry page.
const CHIP = `document.querySelector("main [data-period-suggestion]")`;
const chipState = (p) =>
  p.evaluate(
    `(() => { const c = ${CHIP}; return c ? { type: c.dataset.periodSuggestion, text: c.textContent.trim() } : null; })()`,
  );
const entryUrl = (id) => `/app/groups/${DEV_FAMILY}/entries/${id}`;
const ENTRY_EDITOR = `document.querySelector("main .ProseMirror")`;
const CANCEL = `[...(${FORM}?.querySelectorAll("button") ?? [])].find((b) => b.textContent.trim() === "Cancel")`;

/** Open an entry page and give its suggestion (if any) time to appear: the answer is the chip or null. */
async function openEntry(p, id) {
  await p.goto(entryUrl(id));
  await need(p, ENTRY_EDITOR, 30000, "the entry page");
  // The chip comes from live queries: wait a moment for it either way.
  await p.waitFor(CHIP, 3000, { quiet: true }).catch(() => {});
  return chipState(p);
}

/**
 * The suggestion chip on events: what it offers, the prefilled sheet,
 * saving (the chip goes, the sheet returns to the entry), suppression, other
 * kinds, a viewer, and offline. The events sit 4 days back, in the seeded
 * Home period (Home started 5 days back; this run's other periods start 3
 * days back or later).
 */
async function suggestionSteps(A, proxy, C) {
  const at = (hoursAgo) => {
    const d = new Date(Date.now() - hoursAgo * 3_600_000);
    d.setUTCSeconds(0, 0);
    return d.toISOString();
  };
  const ids = {
    admitted: crypto.randomUUID(),
    home: crypto.randomUUID(),
    rehab: crypto.randomUUID(),
    note: crypto.randomUUID(),
  };
  const T = at(95);
  try {
    await toFront(A);
    const made = await A.evaluate(`(async () => {
      const db = window.caretookSync;
      const { liveEntry, providers } = await window.caretookModules();
      const mk = (id, kind, title, occurredAt) => liveEntry.materializeLiveEntry(db, {
        id, groupId: ${JSON.stringify(DEV_FAMILY)}, kind, title, occurredAt, timeZone: ${JSON.stringify(LA)} });
      const out = [
        await mk(${JSON.stringify(ids.admitted)}, "event", ${JSON.stringify(`${TAG} Admitted to Mercy General`)}, ${JSON.stringify(T)}),
        await mk(${JSON.stringify(ids.home)}, "event", ${JSON.stringify(`${TAG} Discharged home`)}, ${JSON.stringify(at(96))}),
        await mk(${JSON.stringify(ids.rehab)}, "event", ${JSON.stringify(`${TAG} Moved to rehab`)}, ${JSON.stringify(at(96))}),
        await mk(${JSON.stringify(ids.note)}, "note", ${JSON.stringify(`${TAG} Admitted overnight`)}, ${JSON.stringify(at(96))}),
      ];
      const [mercy] = await db.powersync.getAll("SELECT id FROM provider WHERE group_id = ? AND name = 'Mercy General Hospital'", [${JSON.stringify(DEV_FAMILY)}]);
      const [doctor] = await db.powersync.getAll("SELECT id FROM provider WHERE group_id = ? AND type = 'clinician' AND deleted_at IS NULL ORDER BY name LIMIT 1", [${JSON.stringify(DEV_FAMILY)}]);
      // A clinician first: the place is the first linked practice.
      out.push(await providers.linkProvider(db, ${JSON.stringify(ids.admitted)}, doctor.id));
      out.push(await providers.linkProvider(db, ${JSON.stringify(ids.admitted)}, mercy.id));
      return { ok: out.every((r) => r.ok), mercy: mercy.id, out };
    })()`);
    check("events and a note to suggest from", made.ok, JSON.stringify(made.out));

    // An event that says the recipient was admitted offers Hospital.
    const offered = await openEntry(A, ids.admitted);
    check(
      'an event titled "Admitted to Mercy General" offers one chip: "Start a hospital period?"',
      offered?.type === "hospital" &&
        offered.text === "Start a hospital period?" &&
        (await A.evaluate(`document.querySelectorAll("main [data-period-suggestion]").length`)) === 1,
      JSON.stringify(offered),
    );

    // The chip opens the add sheet, prefilled.
    await A.tap(CHIP);
    await need(A, `${FORM} && location.pathname.endsWith("/periods/new")`, 10000, "the prefilled sheet");
    const prefilled = await A.evaluate(`({
      hospital: ${typeRadio("Hospital")}?.checked,
      start: ${formField("startedAt")}?.value ?? null,
      dateOnly: ${formField("dateOnly")}?.checked,
      place: ${PICKER_CHIP},
    })`);
    const startAt = prefilled.start ? Date.parse(prefilled.start.replace(/\[.*\]$/, "")) : NaN;
    check(
      "the chip opens the add sheet with the type, the event's time and its linked practice",
      prefilled.hospital &&
        startAt === Date.parse(T) &&
        !prefilled.dateOnly &&
        prefilled.place === "Mercy General Hospital",
      JSON.stringify({ ...prefilled, T }),
    );
    await A.type(formField("label"), `${TAG} suggested`);
    await A.press(SUBMIT);
    const back = await need(
      A,
      `!${SHEET} && location.pathname === ${JSON.stringify(entryUrl(ids.admitted))} && ${ENTRY_EDITOR}`,
      10000,
      "the sheet to close back to the entry",
    );
    const gone = await need(A, `!${CHIP}`, 10000, "the chip to go");
    const saved = await waitForSql(
      `SELECT cp.type || '|' || to_char(cp.started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI') || '|' || cp.place_provider_id FROM care_period cp WHERE cp.label = '${TAG} suggested' AND cp.deleted_at IS NULL`,
      (v) => v !== "",
    );
    check(
      "saving adds the period and returns to the entry, and the chip goes away",
      back && gone && saved === `hospital|${T.slice(0, 16)}|${made.mercy}`,
      saved,
    );

    // Suppressed: the period at that time is already Home. Notes offer nothing.
    const home = await openEntry(A, ids.home);
    const note = await openEntry(A, ids.note);
    const rehab = await openEntry(A, ids.rehab);
    check(
      'no chip when the period at the event\'s time is already that type ("Discharged home" in Home), or on a note; "Moved to rehab" offers Rehab',
      home === null && note === null && rehab?.type === "rehab",
      JSON.stringify({ home, note, rehab }),
    );

    // A viewer gets no chip.
    const viewer = await openEntry(C, ids.rehab);
    check("a viewer gets no chip", viewer === null, JSON.stringify(viewer));

    // Offline: a renamed event changes the chip, and the sheet still opens.
    await toFront(A);
    await openEntry(A, ids.rehab);
    proxy.setOnline(false);
    await A.waitFor(`!window.caretookSync.powersync.currentStatus.connected`, 15000).catch(() => {});
    const TITLE = `document.querySelector("main header input")`;
    await A.evaluate(`${TITLE}.focus()`);
    await A.type(TITLE, `${TAG} Hospice intake`);
    await A.evaluate(`${TITLE}.blur()`);
    await need(A, `${CHIP}?.dataset.periodSuggestion === "hospiceHome"`, 10000, "the hospice chip offline");
    const hospice = await chipState(A);
    await A.tap(CHIP);
    const sheet = await need(
      A,
      `${FORM} && ${typeRadio("Hospice at home")}?.checked`,
      10000,
      "the sheet offline",
    );
    await A.press(CANCEL);
    const returned = await need(
      A,
      `!${SHEET} && location.pathname === ${JSON.stringify(entryUrl(ids.rehab))} && ${CHIP}`,
      10000,
      "back on the entry offline",
    );
    check(
      'offline: "Hospice intake" offers Hospice at home, its sheet opens prefilled, and Cancel returns to the entry',
      hospice?.text === "Start a hospice at home period?" && sheet && returned,
      JSON.stringify(hospice),
    );
    proxy.setOnline(true);
    await A.waitFor(`window.caretookSync.powersync.currentStatus.connected`, 30000).catch(() => {});
  } finally {
    proxy.setOnline(true);
    psql(
      `UPDATE timeline_entry SET deleted_at = now() WHERE deleted_at IS NULL AND id IN (${Object.values(ids)
        .map((id) => `'${id}'`)
        .join(", ")})`,
    );
  }
}

const proxy = SMOKE ? null : startProxy(9745);
const bA = await launch(9741, proxy ? proxy.args : []);
const bB = SMOKE ? null : await launch(9742);
const bC = SMOKE ? null : await launch(9743);
const pages = [];

try {
  const A = await openPage(bA, "caretaker");
  pages.push(A);
  await A.signIn("caretaker@example.com", PW);
  await step("the seeded track and the periods page", { smoke: true }, () => seedSteps(A));
  const added = await step("adding a period with a new place", { smoke: true }, () => addSteps(A));

  if (!SMOKE) {
    const B = await openPage(bB, "member");
    pages.push(B);
    await B.signIn("member@example.com", PW);
    await step("a second device", () => (added ? secondDeviceSteps(B, added) : undefined));
    await step("an earlier period, and a future start", () => earlierSteps(A));
    await step("offline, and a tie", () => offlineSteps(A, proxy, B));
    const C = await openPage(bC, "viewer");
    pages.push(C);
    await C.signIn("viewer@example.com", PW);
    await step("a viewer", () => viewerSteps(C));
    await step("a period's page and the 404s", () => pageSteps(A, B));
    await step("suggestions from events", () => suggestionSteps(A, proxy, C));
  }

  const noise =
    /401|Failed to load resource|ERR_INTERNET_DISCONNECTED|ERR_PROXY_CONNECTION_FAILED|Failed to fetch|\[PowerSync\]: Sync error|\[PowerSync\]: Initial connect attempt|\[PowerSync\]: Sync aborted|status of 404/;
  const errors = pages.flatMap((p) => p.errors).filter((e) => !noise.test(e));
  check("no console errors or warnings", errors.length === 0, errors.slice(0, 5).join(" | ").slice(0, 800));
} catch (e) {
  check("ran to the end", false, e.message);
} finally {
  try {
    psql(
      `UPDATE care_period SET deleted_at = now() WHERE deleted_at IS NULL AND label LIKE '${TAG}%';
       UPDATE provider SET deleted_at = now() WHERE deleted_at IS NULL AND name LIKE '${TAG}%'`,
    );
  } catch (e) {
    console.log(`clean-up failed: ${e.message}`);
  }
  for (const p of pages) p.close();
  for (const b of [bA, bB, bC]) b?.proc.kill();
  proxy?.close?.();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
