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

// ---------------------------------------------------------------------------
// Slice 3: the timeline's current-period line and boundary markers.
// ---------------------------------------------------------------------------

const TIMELINE = `/app/groups/${DEV_FAMILY}/timeline`;
const LINE = `document.querySelector("main [data-period-line]")`;
const LINE_TEXT = `(document.querySelector("main [data-period-current]")?.textContent.trim() ?? null)`;
const markerLi = (id) => `document.querySelector('main ol > li[data-marker="${id}"]')`;
/** Every row of the history in DOM order: entries by their time, markers by their start. */
const listOrder = (p) =>
  p.evaluate(`[...document.querySelectorAll('main section[aria-labelledby="timeline-heading"] ol > li')].map((li) => ({
    marker: li.dataset.marker ?? null,
    at: li.dataset.at ?? li.querySelector("time")?.dateTime ?? null,
    text: li.dataset.marker ? li.textContent.trim() : null,
    label: li.dataset.marker ? li.querySelector("a")?.getAttribute("aria-label") : null,
    day: li.closest("section")?.querySelector("h3")?.textContent.trim() ?? null,
  }))`);
/** Newest first all the way down: no row is newer than the one above it. */
const inOrder = (rows) =>
  rows.every((r, i) => i === 0 || !r.at || !rows[i - 1].at || new Date(r.at) <= new Date(rows[i - 1].at));
const latestLocal = async (p, groupId) =>
  (
    await localRows(
      p,
      "SELECT id FROM care_period WHERE group_id = ? AND deleted_at IS NULL ORDER BY started_at DESC, created_at DESC, id DESC LIMIT 1",
      [groupId],
    )
  )[0]?.id ?? null;
const END_TEXT = "That's the beginning of the timeline";
const OLDER_STATUS = `(document.querySelector("[data-older-entries] [role=status]")?.textContent ?? "")`;

/** The line on a filtered timeline; Change opens the add sheet; saving comes back with the filter, and the marker. */
async function lineSteps(p) {
  await toFront(p);
  await p.goto(`${TIMELINE}?kind=dose`);
  await need(p, `${LINE_TEXT} !== null`, 20000, "the current-period line");
  const latest = await latestLocal(p, DEV_FAMILY);
  const line = await p.evaluate(`({
    text: ${LINE_TEXT},
    href: document.querySelector("main [data-period-current]")?.getAttribute("href"),
    change: !!document.querySelector("main [data-period-change]"),
  })`);
  check(
    "the timeline's line names the current period with its day count, links to it, and gives a writer Change",
    !!latest &&
      line.href?.endsWith(`/periods/${latest}`) &&
      / · day \d+$/.test(line.text ?? "") &&
      line.change,
    JSON.stringify({ latest, line }),
  );

  await p.tap(`document.querySelector("main [data-period-change]")`);
  const opened = await need(
    p,
    `${FORM} && location.pathname.endsWith("/periods/new")`,
    10000,
    "the add sheet from Change",
  );
  check("Change opens the add sheet", opened);
  await p.press(typeRadio("Rehab or skilled nursing"));
  await p.type(formField("label"), `${TAG} line`);
  await p.press(SUBMIT);
  const back = await need(
    p,
    `!${SHEET} && location.pathname === ${JSON.stringify(TIMELINE)} && location.search === "?kind=dose" && ${LINE_TEXT} === ${JSON.stringify(`In rehab · ${TAG} line · day 1`)}`,
    15000,
    "back on the filtered timeline with the new line",
  );
  check("saving closes the sheet back to the timeline, its filter kept, and the line follows", back);

  const [row] = await localRows(p, "SELECT id FROM care_period WHERE label = ? AND deleted_at IS NULL", [
    `${TAG} line`,
  ]);
  const id = row?.id ?? null;
  await need(p, `!!${markerLi(id)}`, 10000, "the new period's marker");
  const rows = await listOrder(p);
  const mine = rows.find((r) => r.marker === id);
  check(
    "a marker for it shows at its moment under Today, even with the kind filter on, read as one sentence",
    !!mine &&
      new RegExp(`^.+ → Rehab · ${TAG} line · \\d\\d:\\d\\d$`).test(mine.text ?? "") &&
      /^Moved from .+ to Rehab, .+, at \d\d:\d\d$/.test(mine.label ?? "") &&
      mine.day === "Today" &&
      inOrder(rows),
    JSON.stringify({ mine, n: rows.length }),
  );
  await p.screenshot("care-period-timeline-marker");

  await p.tap(`${markerLi(id)}.querySelector("a")`);
  const markerOpens = await need(
    p,
    `location.pathname.endsWith("/periods/${id}") && !!document.querySelector("[data-period-page]")`,
    10000,
    "the marker's period page",
  );
  await p.goto(TIMELINE);
  await need(p, `${LINE_TEXT} !== null`, 20000, "the line");
  await p.tap(`document.querySelector("main [data-period-current]")`);
  const lineOpens = await need(
    p,
    `location.pathname.endsWith("/periods/${id}") && !!document.querySelector("[data-period-page]")`,
    10000,
    "the line's period page",
  );
  check("the marker and the line each open the period", markerOpens && lineOpens);
  return id;
}

/** The marker with an author filter on, in cards, and for a viewer (line without Change). */
async function markerViewSteps(p, viewer, id) {
  const caretaker = psql(`SELECT id FROM "user" WHERE email = 'caretaker@example.com'`);
  await toFront(p);
  await p.goto(`${TIMELINE}?author=${caretaker}`);
  const byAuthor = await need(p, `!!${markerLi(id)}`, 20000, "the marker under the author filter");
  check("the marker shows with an author filter on", byAuthor);

  await p.goto(TIMELINE);
  await need(p, `!!${markerLi(id)}`, 20000, "the marker");
  await p.press(`document.querySelector('[aria-label="Cards"]')`);
  const cards = await need(
    p,
    `document.querySelector('main ol[data-view="cards"] > li[data-marker="${id}"]')`,
    8000,
    "the marker in cards",
  );
  await p.screenshot("care-period-marker-cards");
  await p.press(`document.querySelector('[aria-label="Rows"]')`);
  await need(p, `document.querySelector("main ol")?.dataset.view === "rows"`, 8000, "rows again");
  check("the marker shows in the cards view too", cards);

  await toFront(viewer);
  await viewer.goto(TIMELINE);
  await need(viewer, `${LINE_TEXT} !== null && !!${markerLi(id)}`, 30000, "the viewer's line and marker");
  const seen = await viewer.evaluate(
    `({ text: ${LINE_TEXT}, change: !!document.querySelector("main [data-period-change]") })`,
  );
  check(
    "a viewer sees the line (no Change) and the marker",
    seen.text === `In rehab · ${TAG} line · day 1` && !seen.change,
    JSON.stringify(seen),
  );
}

/** A group with no periods: a writer is asked where the recipient is (the sheet closes back); a viewer sees nothing. */
async function promptSteps(writer, viewer) {
  const timeline2 = `/app/groups/${DEV_FAMILY_2}/timeline`;
  await toFront(writer);
  await writer.goto(timeline2);
  await need(writer, `document.querySelector('main [data-period-line="empty"]')`, 20000, "the prompt");
  const prompt = await writer.evaluate(
    `document.querySelector('main [data-period-line="empty"]')?.textContent.trim()`,
  );
  check(
    "a writer on a group with no periods is asked where the recipient is, with Add care period",
    /^Where is .+ now\?Add care period$/.test(prompt ?? ""),
    prompt,
  );
  await writer.tap(`document.querySelector("main [data-period-add]")`);
  await need(writer, `${FORM} && location.pathname.endsWith("/periods/new")`, 10000, "the add sheet");
  await writer.press(
    `[...${FORM}.querySelectorAll("button")].find((b) => b.textContent.trim() === "Cancel")`,
  );
  const closed = await need(
    writer,
    `!${SHEET} && location.pathname === ${JSON.stringify(timeline2)}`,
    10000,
    "back to the timeline",
  );
  check("Add care period opens the add sheet, and Cancel comes back to the timeline", closed);

  // viewer@ joins Dev Family 2 as a viewer for this step only.
  const viewerId = psql(`SELECT id FROM "user" WHERE email = 'viewer@example.com'`);
  psql(
    `INSERT INTO care_group_member (group_id, user_id, role, created_by, updated_by) VALUES ('${DEV_FAMILY_2}', '${viewerId}', 'viewer', '${viewerId}', '${viewerId}') ON CONFLICT DO NOTHING`,
  );
  try {
    await waitForLocal(
      viewer,
      "SELECT id FROM care_group WHERE id = ?",
      [DEV_FAMILY_2],
      (rows) => rows.length === 1,
      20000,
    );
    await toFront(viewer);
    await viewer.goto(timeline2);
    await need(
      viewer,
      `document.querySelectorAll("main ol > li").length > 0`,
      30000,
      "the viewer's timeline",
    );
    await sleep(1000);
    const line = await viewer.evaluate(`!!${LINE}`);
    check("a viewer on a group with no periods sees no line", !line);
  } finally {
    psql(`DELETE FROM care_group_member WHERE group_id = '${DEV_FAMILY_2}' AND user_id = '${viewerId}'`);
  }
}

/** Scrolling back: markers come with their part of the timeline, never out of place; at the beginning, every one shows. */
async function scrollSteps(p) {
  await toFront(p);
  await p.goto(TIMELINE);
  await need(p, `document.querySelectorAll("main ol > li:not([data-marker])").length >= 30`, 20000, "a page");
  const first = await listOrder(p);
  const oldest = first.filter((r) => !r.marker).at(-1)?.at;
  check(
    "on the first page, only markers at or after its oldest entry show",
    first.filter((r) => r.marker).every((r) => new Date(r.at) >= new Date(oldest)) && inOrder(first),
    JSON.stringify(first.filter((r) => r.marker).map((r) => r.at)),
  );
  const started = Date.now();
  let samples = 0;
  let outOfOrder = null;
  while (Date.now() - started < 90000) {
    const status = await p.evaluate(`(() => { const t = ${OLDER_STATUS};
      if (t !== "Loading older…") window.scrollTo(0, document.documentElement.scrollHeight); return t; })()`);
    const rows = await listOrder(p);
    samples++;
    const entries = rows.filter((r) => !r.marker);
    const low = entries.at(-1)?.at;
    if (
      !outOfOrder &&
      (!inOrder(rows) ||
        (status !== END_TEXT && rows.some((r) => r.marker && low && new Date(r.at) < new Date(low))))
    )
      outOfOrder = { status, rows: rows.length, low };
    if (status === END_TEXT) break;
    await sleep(300);
  }
  const all = await listOrder(p);
  const seeded = all.filter((r) => r.marker?.startsWith("0b6f3c1e-5d1a-4c2e-9a77-3f1d2bc1"));
  check(
    "scrolling back never shows a marker out of place",
    !outOfOrder && samples > 1,
    JSON.stringify(outOfOrder),
  );
  check(
    'at the beginning every seeded marker shows, oldest "Started: Home", with the hospital\'s place and room',
    (await p.evaluate(OLDER_STATUS)) === END_TEXT &&
      seeded.length === 5 &&
      seeded.at(-1).text?.startsWith("Started: Home") &&
      seeded.some((r) =>
        /^Emergency room → Hospital · Mercy General Hospital, room 412, bed B · \d\d:\d\d$/.test(
          r.text ?? "",
        ),
      ) &&
      inOrder(all),
    JSON.stringify(seeded.map((r) => r.text)),
  );
  await p.screenshot("care-period-markers-beginning");
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
  }

  // Slice 3: the timeline.
  const lined = await step("the timeline's line, Change and the marker", { smoke: true }, () => lineSteps(A));
  if (!SMOKE) {
    const [, B, C] = pages;
    await step("markers under an author filter, in cards, and for a viewer", () =>
      lined ? markerViewSteps(A, C, lined) : undefined,
    );
    await step("the prompt on a group with no periods", () => promptSteps(B, C));
    await step("markers while scrolling back", () => scrollSteps(A));
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
