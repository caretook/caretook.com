// Live notes, end to end: notes and events are their live document (the live
// notes UX PRD). One check for every flow: one-tap starts (Note 1 tap, Event
// 1, a named event 2, Join 1), the abandoned draft, the URL replace, default
// titles and title chips, the header (time chip, Delete, Share), who's typing
// (avatars), the Live now banner and live dot, convergence, offline,
// authorship, the viewer, the sheet, sign-in and 404s.
//
// Self-contained and order-independent: every step makes its own fresh,
// uniquely titled entries and asserts relative to them, never to global idle
// state or seed order. Before the "who's typing" steps, the check moves its
// own documents' edit times back an hour in Postgres (`quiet`), so they're
// idle whatever ran before. At the end it soft-deletes what it made. So it
// passes run after run, without a `pnpm datastore:reset`.
//
// Four browsers in Dev Family: member@ (owner, through a switchable proxy for
// the offline steps, with no share sheet so Share falls back to the
// clipboard), caretaker@, viewer@ (with a recording share sheet), and a fresh
// one that starts signed out (then caretaker@, then admin@, not a member).
import { execSync } from "node:child_process";
import { BASE, launch, openPage, sleep } from "./cdp.mjs";
import { startProxy } from "./proxy.mjs";

const PG_CONTAINER = process.env.PG_CONTAINER ?? "caretook-postgres-1";
const PW = process.env.SEED_USER_PASSWORD ?? "caretook-dev-password";
const started = Date.now();

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const step = (title) => console.log(`\n# ${title}  [${Math.round((Date.now() - started) / 1000)} s]`);

// The SQL goes in on stdin, so quotes and newlines need no shell escaping.
const psql = (sql) =>
  execSync(`docker exec -i ${PG_CONTAINER} psql -U caretook -d caretook -tAq -v ON_ERROR_STOP=1`, {
    input: `${sql};`,
  })
    .toString()
    .trim();
/** Poll Postgres until `test(result)` holds (default: not "", "0" or "f"). */
const waitForSql = async (sql, test = (r) => r && r !== "0" && r !== "f", ms = 15000) => {
  const end = Date.now() + ms;
  let last = "";
  while (Date.now() < end) {
    last = psql(sql);
    if (test(last)) return last;
    await sleep(300);
  }
  return last;
};
const inList = (ids) => ids.map((id) => `'${id}'`).join(",");

// ---- Selectors ---------------------------------------------------------------
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const ON_ENTRY = `/\\/entries\\/${UUID}$/.test(location.pathname)`;
const ON_DRAFT = `location.pathname.endsWith("/entries/new")`;
const tile = (text) =>
  `[...document.querySelectorAll('[aria-label="Add to the timeline"] a, [aria-label="Add to the timeline"] button')].find((b) => b.textContent.trim() === ${JSON.stringify(text)})`;
const TIMELINE_LINK = `[...document.querySelectorAll("main a")].find((a) => a.textContent.trim() === "Timeline")`;
const button = (text) =>
  `[...document.querySelectorAll("button")].find((b) => b.textContent.trim() === ${JSON.stringify(text)})`;
const menuItem = (text) =>
  `[...document.querySelectorAll("[role=menuitem]")].find((m) => m.textContent.trim() === ${JSON.stringify(text)})`;
const dialogButton = (text) =>
  `[...document.querySelectorAll("dialog[open] button")].find((b) => b.textContent.trim() === ${JSON.stringify(text)})`;
const bodyHas = (text) => `document.body.textContent.includes(${JSON.stringify(text)})`;

const HEADER = `document.querySelector("main header")`;
const TITLE = `document.querySelector("main header input")`;
const EDITOR = `document.querySelector(".ProseMirror")`;
const EDITOR_FOCUSED = `document.activeElement?.classList.contains("ProseMirror")`;
const editorHas = (text) => `!!${EDITOR}?.textContent.includes(${JSON.stringify(text)})`;
const TOOLBAR = `document.querySelector('[role=toolbar][aria-label="Formatting"]')`;
const TIME_CHIP = `document.querySelector('main header button[aria-label="Change when it happened"]')`;
const HEADER_TIME = `document.querySelector("main header time")`;
const DAY_SEGMENT = `document.querySelector('[role=dialog] [data-type="day"]')`;
const PICK_DATE = `document.querySelector('[role=dialog] [aria-label="Pick a date"]')`;
const CAL_GRID = `document.querySelector("[role=grid]")`;
const CAL_HEADING = `${CAL_GRID}?.closest("[role=dialog]")?.querySelector("h2")?.textContent.trim()`;
const NEXT_MONTH = `${CAL_GRID}?.closest("[role=dialog]")?.querySelector('[aria-label="Next month"]')`;
const calDay = (day) =>
  `[...document.querySelectorAll("[role=grid] [role=gridcell] > *")].find((c) => c.textContent.trim() === ${JSON.stringify(day)} && !c.hasAttribute("data-outside-month"))`;
const MENU = `document.querySelector('main header [data-region="actions"] button[aria-label^="Actions for"]')`;
const SHARE = `document.querySelector('main header [data-region="actions"] button[aria-label="Share"]')`;
const CHIPS = `[...document.querySelectorAll('main header ul[aria-label="Suggested titles"] button')]`;
const chip = (text) => `${CHIPS}.find((b) => b.textContent.trim() === ${JSON.stringify(text)})`;
const AVATARS = `[...document.querySelectorAll('main [data-region="editors"] [data-person]')]`;
const hasAvatar = (id) => `${AVATARS}.some((el) => el.dataset.person === ${JSON.stringify(id)})`;
const BANNER = `document.querySelector('main section[aria-label="Live now"]')`;
const BANNER_ID = `(${BANNER}?.dataset.liveBanner ?? null)`;
const STATUS = `document.querySelector('main p[role="status"]')`;
const ROWS = `document.querySelectorAll("main ol > li").length`;
const rowOf = (id) => `document.querySelector('main ol > li a[href$="/entries/${id}"]')?.closest("li")`;
const dotOf = (id) => `${rowOf(id)}?.querySelector("[data-live-dot]")`;
const dayOfRow = (id) => `(${rowOf(id)}?.closest("section")?.querySelector("h3")?.textContent ?? null)`;
const localRows = (sql, params = []) =>
  `window.caretookSync.powersync.getAll(${JSON.stringify(sql)}, ${JSON.stringify(params)})`;
const localCount = (table) => `${localRows(`SELECT count(*) AS n FROM ${table}`)}.then((r) => r[0].n)`;
const entryPath = (id) => `/app/groups/${GROUP}/entries/${id}`;

// ---- Input -------------------------------------------------------------------
/** Real taps are counted, for the tap-count checks. */
let taps = 0;
const tap = async (p, selector) => {
  await p.tap(selector);
  taps++;
};
/** Type into the editor as a person would: focus the end, then insert text. */
async function typeInEditor(p, text) {
  await p.evaluate(`(() => { const el = ${EDITOR}; el.focus();
    const sel = getSelection(); sel.selectAllChildren(el); sel.collapseToEnd(); return true; })()`);
  await p.send("Input.insertText", { text });
}
async function pressKey(p, key, code, keyCode, text) {
  await p.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key,
    code,
    windowsVirtualKeyCode: keyCode,
    ...(text ? { text } : {}),
  });
  await p.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: keyCode });
}
const newParagraph = (p) => pressKey(p, "Enter", "Enter", 13, "\r");
const escape = (p) => pressKey(p, "Escape", "Escape", 27);
const setTitle = async (p, value) => {
  await p.evaluate(`${TITLE}.focus()`);
  await p.type(TITLE, value);
};
const blurTitle = (p) => p.evaluate(`${TITLE}.blur()`);
const idFromPath = (path) => path.split("/").at(-1);

/**
 * A full page load, then wait for PowerSync to connect: each load connects
 * afresh, and right after a reset that first connect can fail on a 401 while
 * PowerSync refetches the JWKS, retrying a few seconds later. Uploads wait
 * for it too, so timed steps start only once it's up.
 */
async function visit(p, path) {
  const CONNECTED = `window.caretookSync?.powersync.currentStatus.connected`;
  await p.goto(path);
  // Seen after a reset: PowerSync keeps refusing one page's token ("no key
  // matched the token KID") while other pages connect. Load it once more.
  if (
    await p.waitFor(CONNECTED, 15000).then(
      () => false,
      () => true,
    )
  ) {
    console.log(`  (${path}: PowerSync didn't connect in 15 s; loading it again)`);
    await p.goto(path);
    await p.waitFor(CONNECTED, 30000);
  }
}
/**
 * Open an entry from the timeline in the app, as a person would. The page
 * keeps its database and sync stream, so a timed step right after doesn't
 * wait on a fresh connect (which a full page load needs).
 */
async function openFromTimeline(p, id) {
  await toTimeline(p);
  await p.waitFor(rowOf(id), 10000);
  await p.press(`${rowOf(id)}.querySelector('a[aria-label^="Open "]')`);
  await p.waitFor(`location.pathname === ${JSON.stringify(entryPath(id))} && ${EDITOR}`, 15000);
}
/** In-app navigation back to the timeline (works offline, unlike a page load). */
async function toTimeline(p) {
  if (!(await p.evaluate(`location.pathname === ${JSON.stringify(TIMELINE)}`))) await p.press(TIMELINE_LINK);
  await p.waitFor(`location.pathname === ${JSON.stringify(TIMELINE)} && ${ROWS} > 0`, 15000);
}
/** From the timeline, tap Event (or Note): the draft opens with the cursor in its document. */
async function start(p, kind) {
  await toTimeline(p);
  await p.waitFor(tile(kind), 10000);
  await tap(p, tile(kind));
  await p.waitFor(`${ON_DRAFT} && ${EDITOR_FOCUSED}`, 15000);
}
/** Open the time chip, move the day by `steps` (negative = earlier), then Done. */
async function shiftDay(p, steps) {
  await p.press(TIME_CHIP);
  await p.waitFor(DAY_SEGMENT, 5000);
  await p.evaluate(`${DAY_SEGMENT}.focus()`);
  for (let i = 0; i < Math.abs(steps); i++) {
    if (steps < 0) await pressKey(p, "ArrowDown", "ArrowDown", 40);
    else await pressKey(p, "ArrowUp", "ArrowUp", 38);
  }
  await p.press(button("Done"));
  await p.waitFor(`!${DAY_SEGMENT}`, 5000);
}
const headerTimeMs = (p) => p.evaluate(`new Date(${HEADER_TIME}.dateTime).getTime()`);
const DAY_MS = 86_400_000;

/**
 * Wait for `ready`, then make sure the page doesn't reload under us: on a
 * fresh dev server, the first visit to a route can make Vite re-optimise
 * its dependencies and reload the page.
 */
async function settle(p, ready) {
  await p.waitFor(ready, 30000);
  await p.evaluate("window.__settled = true");
  await sleep(1500);
  if (!(await p.evaluate("window.__settled === true").catch(() => false))) await p.waitFor(ready, 30000);
}

/** Sign in; on a fresh dev server the first page load can fail while Vite optimises, so allow one retry. */
async function signInWarm(p, email) {
  try {
    await p.signIn(email, PW);
  } catch {
    p.errors.length = 0;
    await sleep(2000);
    await p.signIn(email, PW);
  }
}

// ---- Who's typing: edit times ------------------------------------------------
/** Move these documents' edit times (editors and pending updates) to `seconds` ago. */
const backdate = (ids, seconds) =>
  psql(`UPDATE note_document SET editors = coalesce((SELECT jsonb_object_agg(k, to_char((now() - interval '${seconds} seconds') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) FROM jsonb_object_keys(editors) k), '{}'::jsonb) WHERE id IN (${inList(ids)});
    UPDATE note_update SET created_at = now() - interval '${seconds} seconds' WHERE document_id IN (${inList(ids)})`);
/** True on a device once every edit it has for these documents is older than `ms`. */
const editsOlderThan = (ids, ms) =>
  `${localRows(
    `SELECT d.editors, (SELECT max(created_at) FROM note_update u WHERE u.document_id = d.id) AS u FROM note_document d WHERE d.id IN (${ids.map(() => "?").join(",")})`,
    ids,
  )}.then((rows) => rows.length === ${ids.length} && rows.every((r) =>
    Object.values(JSON.parse(r.editors || "{}")).every((t) => Date.now() - Date.parse(t) > ${ms}) &&
    (!r.u || Date.now() - Date.parse(r.u) > ${ms})))`;
/** Make these documents idle (last edit an hour ago) on the server and on every observer. */
async function quiet(ids, observers) {
  await sleep(1500); // let the last typing burst flush and upload
  for (let attempt = 0; attempt < 3; attempt++) {
    backdate(ids, 3600);
    await Promise.all(observers.map((p) => p.waitFor(editsOlderThan(ids, 3_000_000), 15000)));
    await sleep(1000);
    const still = await Promise.all(observers.map((p) => p.evaluate(editsOlderThan(ids, 3_000_000))));
    if (still.every(Boolean)) return;
  }
  throw new Error("couldn't quiet the check's documents");
}

// Every non-empty text the timeline's status region takes, from now on.
const watchAnnouncements = (p) =>
  p.evaluate(`(() => { window.__announced = []; const el = ${STATUS};
    if (el.textContent) window.__announced.push(el.textContent);
    new MutationObserver(() => { if (el.textContent) window.__announced.push(el.textContent); })
      .observe(el, { childList: true, characterData: true, subtree: true }); return true; })()`);
const announcedFor = async (p, title) =>
  (await p.evaluate(`window.__announced`)).filter((s) => s.endsWith(`: ${title}`));

// ---- Fixtures from the seeds -------------------------------------------------
const user = (email) => psql(`SELECT id || '|' || name FROM "user" WHERE email = '${email}'`).split("|");
const [MEMBER, MEMBER_NAME] = user("member@example.com");
const [CARETAKER] = user("caretaker@example.com");
const [VIEWER] = user("viewer@example.com");
const GROUP = psql(
  `SELECT m.group_id FROM care_group_member m JOIN "user" u ON u.id = m.user_id WHERE u.email = 'viewer@example.com' LIMIT 1`,
);
const TIMELINE = `/app/groups/${GROUP}/timeline`;
const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const tag = `LN-${Date.now().toString(36)}`;
/** Every entry this run makes: soft-deleted at the end. */
const made = [];

const proxyA = startProxy(9421);
const bA = await launch(9411, proxyA.args);
const bB = await launch(9412);
const bC = await launch(9413);
const bD = await launch(9414);
const pages = [];
try {
  const A = await openPage(bA, "member");
  const B = await openPage(bB, "caretaker");
  const C = await openPage(bC, "viewer");
  const D = await openPage(bD, "fresh");
  pages.push(A, B, C, D);

  // member@: no share sheet, so Share copies. The clipboard is the real one, read back later.
  await A.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `delete Navigator.prototype.share; delete Navigator.prototype.canShare;`,
  });
  // Headless pages aren't focused, and the clipboard needs focus.
  await A.send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await A.send("Browser.grantPermissions", {
    origin: new URL(BASE).origin,
    permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"],
  });
  // viewer@: a share sheet that records what it was given.
  await C.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `window.__shared = []; Navigator.prototype.share = function (d) { window.__shared.push(d); return Promise.resolve(); };
      Navigator.prototype.canShare = () => true;`,
  });

  step("Sign in, and warm the routes");
  // caretaker@ (not proxied) visits the timeline and the editor first, so a
  // Vite re-optimise reload on a fresh dev server happens here, not mid-step.
  await signInWarm(B, "caretaker@example.com");
  await visit(B, TIMELINE);
  await settle(B, `${ROWS} > 0`);
  await visit(B, `/app/groups/${GROUP}/entries/new?kind=note`);
  await settle(B, EDITOR);
  await signInWarm(A, "member@example.com");
  await signInWarm(C, "viewer@example.com");
  for (const p of [A, B, C]) {
    await visit(p, TIMELINE);
    await settle(p, `${ROWS} > 0`);
  }
  // Right after a reset, PowerSync's first connect can fail on a 401 while it
  // refetches the regenerated JWKS, and retries a few seconds later: wait
  // until every device is connected, so the timed steps don't measure that.
  await Promise.all(
    [A, B, C].map((p) => p.waitFor(`window.caretookSync?.powersync.currentStatus.connected`, 30000)),
  );
  // The one reload the warm-up is for, if it happened, isn't an error.
  const warmNoise = /Error loading route module|Failed to fetch dynamically imported module/;
  for (const p of [A, B, C])
    p.errors.splice(0, p.errors.length, ...p.errors.filter((e) => !warmNoise.test(e)));
  check("setup: three members see the timeline", true);

  // -------------------------------------------------------------------------
  step("A draft that's left writes nothing");
  const counts = async () =>
    JSON.stringify({
      entries: await A.evaluate(localCount("timeline_entry")),
      docs: await A.evaluate(localCount("note_document")),
      pgEntries: psql("SELECT count(*) FROM timeline_entry"),
      pgDocs: psql("SELECT count(*) FROM note_document"),
    });
  const before = await counts();
  await start(A, "Note");
  check(
    "draft: the header has the time chip, and no Share or ⋯ menu yet",
    await A.evaluate(`!!${TIME_CHIP} && !${SHARE} && !${MENU}`),
  );
  await sleep(1500);
  await toTimeline(A);
  await sleep(1500);
  const after = await counts();
  check("draft: leaving without typing writes nothing (local and Postgres)", before === after, after);

  // -------------------------------------------------------------------------
  step("Note: one tap, saved on the first keystroke");
  const historyBefore = await A.evaluate("history.length");
  taps = 0;
  await start(A, "Note");
  check("note: typing after 1 tap (Note), with the cursor in the document", taps === 1, `${taps} tap`);
  check(
    "note: the time defaults to now",
    await A.evaluate(`Math.abs(new Date(${HEADER_TIME}.dateTime) - Date.now()) < 60000`),
  );
  await A.send("Input.insertText", { text: `${tag} first words` });
  await A.waitFor(ON_ENTRY, 5000);
  const N1 = idFromPath(await A.evaluate("location.pathname"));
  made.push(N1);
  check("note: the first keystroke replaces the URL with the entry's", true, entryPath(N1));
  check(
    "note: replaced, not pushed",
    (await A.evaluate("history.length")) === historyBefore + 1,
    `history ${historyBefore} → ${await A.evaluate("history.length")}`,
  );
  check(
    "note: the editor kept the text and focus",
    await A.evaluate(`${editorHas(`${tag} first words`)} && ${EDITOR_FOCUSED}`),
  );
  const N1_TITLE = `${tag} Morning`;
  await setTitle(A, N1_TITLE);
  await blurTitle(A);
  const stored = await waitForSql(
    `SELECT e.kind || '|' || coalesce(e.body, 'NULL') || '|' || coalesce(e.title, '') || '|' || u.email FROM timeline_entry e JOIN "user" u ON u.id = e.created_by JOIN note_document d ON d.id = e.id WHERE e.id = '${N1}'`,
    (r) => r.includes(N1_TITLE),
  );
  check(
    "note: in Postgres with a null body, its document and its title, as the member",
    stored === `note|NULL|${N1_TITLE}|member@example.com`,
    stored,
  );
  const n1Authors = await waitForSql(
    `SELECT coalesce((SELECT string_agg(DISTINCT u.email, ',') FROM note_update n JOIN "user" u ON u.id = n.created_by WHERE n.document_id = '${N1}'), (SELECT CASE WHEN snapshot IS NOT NULL THEN 'compacted' END FROM note_document WHERE id = '${N1}'), '')`,
  );
  check(
    "note: edits stored as the member",
    n1Authors === "member@example.com" || n1Authors === "compacted",
    n1Authors,
  );
  await A.evaluate("history.back()");
  await A.waitFor(`location.pathname === ${JSON.stringify(TIMELINE)}`, 10000);
  check("note: Back returns to the timeline (the draft's URL is gone)", true);
  await C.waitFor(`${rowOf(N1)}?.textContent.includes(${JSON.stringify(`${tag} first words`)})`, 20000);
  check(
    "note: the viewer's row shows the document as its body, with no live notes block",
    await C.evaluate(
      `${rowOf(N1)}.textContent.includes(${JSON.stringify(N1_TITLE)}) && !/live notes/i.test(${rowOf(N1)}.textContent)`,
    ),
  );

  // -------------------------------------------------------------------------
  step('Event: one tap; an unnamed event is saved as "Event"');
  const eventsBefore = psql(`SELECT count(*) FROM timeline_entry WHERE kind = 'event'`);
  taps = 0;
  await start(A, "Event");
  check(
    "event: typing after 1 tap (Event), with the title field at the top",
    taps === 1 &&
      (await A.evaluate(`${TITLE}?.placeholder === "Title" && location.search === "?kind=event"`)),
    `${taps} tap`,
  );
  await A.waitFor(`${CHIPS}.length > 0`, 10000);
  const seeded = await A.evaluate(`${CHIPS}.map((b) => b.textContent.trim())`);
  check(
    'chips: up to 5 of the group\'s recent titles, such as "Physical therapy", never "Event"',
    seeded.length <= 5 && seeded.includes("Physical therapy") && !seeded.includes("Event"),
    seeded.join(" · "),
  );
  await sleep(1000);
  check(
    "chips: showing them saves nothing",
    psql(`SELECT count(*) FROM timeline_entry WHERE kind = 'event'`) === eventsBefore,
  );
  await A.send("Input.insertText", { text: `${tag} event start` });
  await A.waitFor(ON_ENTRY, 10000);
  const E1 = idFromPath(await A.evaluate("location.pathname"));
  made.push(E1);
  await A.waitFor(`${TITLE}?.placeholder === "Add a title" && ${TITLE}.value === ""`, 10000);
  check('event: saved as "Event", with an "Add a title" prompt', true);
  await A.waitFor(
    `${localRows("SELECT title, body FROM timeline_entry WHERE id = ?", [E1])}.then((r) => r[0]?.title === "Event" && r[0]?.body === null)`,
  );
  check('event: stored locally as "Event", with no body', true);
  check(
    "event: the chips stay until it has a name, and writers get the toolbar",
    await A.evaluate(`${CHIPS}.length > 0 && !!${TOOLBAR}`),
  );
  // Once it has synced to the viewer (row and document), open it from the timeline.
  await C.waitFor(`${rowOf(E1)}?.textContent.includes(${JSON.stringify(`${tag} event start`)})`, 20000);
  await C.press(`${rowOf(E1)}.querySelector('a[aria-label^="Open "]')`);
  await C.waitFor(editorHas(`${tag} event start`), 15000);
  check(
    'viewer: sees "Event", read-only, with no title field, chips or toolbar',
    await C.evaluate(
      `${HEADER}.textContent.includes("Event") && !${TITLE} && !document.querySelector('[aria-label="Suggested titles"]') && !${TOOLBAR} && ${EDITOR}.getAttribute("contenteditable") === "false"`,
    ),
  );
  const pick = (await A.evaluate(`${CHIPS}.map((b) => b.textContent.trim())`))[0];
  await A.tap(chip(pick));
  await A.waitFor(`${TITLE}?.value === ${JSON.stringify(pick)} && ${CHIPS}.length === 0`, 10000);
  await C.waitFor(`${HEADER}?.textContent.includes(${JSON.stringify(pick)})`, 15000);
  check("event: a chip renames an existing unnamed event, and it reaches the viewer", true, pick);
  const E1_TITLE = `${tag} Dr. Lee visit`;
  await setTitle(A, E1_TITLE);
  await blurTitle(A);
  await C.waitFor(`${HEADER}?.textContent.includes(${JSON.stringify(E1_TITLE)})`, 15000);
  check("event: a typed rename reaches the viewer", await A.evaluate(`${TITLE}.placeholder === "Title"`));
  const e1Stored = await waitForSql(
    `SELECT title || '|' || coalesce(body, 'null') FROM timeline_entry WHERE id = '${E1}'`,
    (r) => r.startsWith(E1_TITLE),
  );
  check("event: the rename is in Postgres, with no body", e1Stored === `${E1_TITLE}|null`, e1Stored);

  // -------------------------------------------------------------------------
  step("A named event in 2 taps: Event, then a chip");
  taps = 0;
  await start(A, "Event");
  await A.waitFor(chip("Physical therapy"), 10000);
  await tap(A, chip("Physical therapy"));
  await A.waitFor(ON_ENTRY, 10000);
  const E2 = idFromPath(await A.evaluate("location.pathname"));
  made.push(E2);
  await A.waitFor(`${TITLE}?.value === "Physical therapy" && ${CHIPS}.length === 0`, 10000);
  check("chip: a named event in 2 taps (Event, chip)", taps === 2, `${taps} taps`);
  check(
    "chip: saved locally with that title, and the cursor is in the document",
    (await A.evaluate(
      `${localRows("SELECT title FROM timeline_entry WHERE id = ?", [E2])}.then((r) => r[0]?.title)`,
    )) === "Physical therapy" && (await A.evaluate(EDITOR_FOCUSED)),
  );
  check(
    "chip: stored in Postgres",
    (await waitForSql(`SELECT title FROM timeline_entry WHERE id = '${E2}'`)) === "Physical therapy",
  );

  // -------------------------------------------------------------------------
  step("Chips: typing hides them, ranking, deleted titles");
  await start(A, "Event");
  await A.waitFor(`${CHIPS}.length > 0`, 10000);
  const custom = `${tag} Podiatrist`;
  await setTitle(A, custom);
  await A.waitFor(`${CHIPS}.length === 0`, 3000);
  check("chips: they go once a title is typed", true);
  await A.type(TITLE, "");
  await A.waitFor(`${CHIPS}.length > 0`, 3000);
  check("chips: clearing the field brings them back", true);
  await A.type(TITLE, custom);
  await blurTitle(A);
  await A.waitFor(ON_ENTRY, 10000);
  const E3 = idFromPath(await A.evaluate("location.pathname"));
  made.push(E3);
  await A.waitFor(`${TITLE}?.value === ${JSON.stringify(custom)}`, 10000);
  check("chips: a typed title saves the event, with no chips", (await A.evaluate(`${CHIPS}.length`)) === 0);
  await start(A, "Event");
  await A.waitFor(`${CHIPS}.length > 0`, 10000);
  const ranked = await A.evaluate(`${CHIPS}.map((b) => b.textContent.trim())`);
  // "Physical therapy" was just used too, on top of its seeded uses: it stays ahead of a one-off.
  check(
    "ranking: a title just used is suggested, behind one used more often",
    ranked.includes(custom) && ranked.indexOf("Physical therapy") < ranked.indexOf(custom),
    ranked.join(" · "),
  );
  await A.evaluate(
    `window.caretookSync.powersync.execute("UPDATE timeline_entry SET deleted_at = ? WHERE id = ?", [new Date().toISOString(), ${JSON.stringify(E3)}])`,
  );
  await A.waitFor(`!${chip(custom)}`, 10000);
  check("ranking: a deleted event's title is left out", (await A.evaluate(`${CHIPS}.length`)) > 0);
  await toTimeline(A);

  // -------------------------------------------------------------------------
  step("Live now: the banner and the live dot");
  await quiet([N1, E1, E2], [B, C]);
  for (const p of [B, C]) {
    await visit(p, TIMELINE);
    await p.waitFor(`${rowOf(N1)} && ${rowOf(E1)} && ${rowOf(E2)}`, 20000);
  }
  await watchAnnouncements(B);
  const ours = JSON.stringify([N1, E1, E2]);
  check(
    "idle: no live dot on the check's entries, and the banner isn't for them",
    await B.evaluate(`!${dotOf(N1)} && !${dotOf(E1)} && !${dotOf(E2)} && !${ours}.includes(${BANNER_ID})`),
  );
  await openFromTimeline(A, N1);
  let t0 = Date.now();
  await typeInEditor(A, ` ${tag}-live1`);
  await Promise.all(
    [B, C].map((p) => p.waitFor(`${BANNER_ID} === ${JSON.stringify(N1)} && ${dotOf(N1)}`, 8000)),
  );
  let latency = Date.now() - t0;
  check("appear: banner and dot within ~2 s", latency <= 2500, `${latency} ms`);
  const bannerText = await B.evaluate(`${BANNER}.innerText.replace(/\\s+/g, " ").trim()`);
  check(
    "banner: '<name> is writing · <title> · Join'",
    bannerText.startsWith(`${MEMBER_NAME} is writing · ${N1_TITLE}`) && bannerText.endsWith("Join"),
    bannerText,
  );
  check("viewer: sees the banner too", (await C.evaluate(BANNER_ID)) === N1);
  check(
    "dot: its sr-only label names the writer",
    (await B.evaluate(`${dotOf(N1)}.textContent`)) === `Being written now by ${MEMBER_NAME}`,
  );
  check("dot: only on the row being written", await B.evaluate(`!${dotOf(E1)} && !${dotOf(E2)}`));
  check(
    "dot: taps go through to the row's open target",
    await B.evaluate(`(() => { const r = ${dotOf(N1)}.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return hit?.matches('a[aria-label^="Open "]') && hit.closest("li") === ${rowOf(N1)}; })()`),
  );
  const ping = `getComputedStyle(${dotOf(N1)}.firstElementChild)`;
  check("motion: the dot pulses", (await B.evaluate(`${ping}.animationName`)) === "ping");
  await B.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  check("motion: static under prefers-reduced-motion", (await B.evaluate(`${ping}.display`)) === "none");
  await B.send("Emulation.setEmulatedMedia", { features: [] });
  await B.screenshot("ln-banner");
  for (let i = 0; i < 3; i++) {
    await typeInEditor(A, ` more${i}`);
    await sleep(700);
  }
  await sleep(1000);
  let said = await announcedFor(B, N1_TITLE);
  check(
    "announce: once for the document, however often it's edited",
    said.length === 1 && said[0] === `${MEMBER_NAME} is writing: ${N1_TITLE}`,
    JSON.stringify(said),
  );
  await toTimeline(A);
  await sleep(1500);
  check(
    "self: the writer sees no banner or dot for their own typing",
    await A.evaluate(`!!${rowOf(N1)} && !${dotOf(N1)} && ${BANNER_ID} !== ${JSON.stringify(N1)}`),
  );
  await openFromTimeline(A, E1);
  await typeInEditor(A, ` ${tag}-live2`);
  await B.waitFor(`${BANNER_ID} === ${JSON.stringify(E1)}`, 8000);
  const two = await B.evaluate(`${BANNER}.innerText.replace(/\\s+/g, " ").trim()`);
  check("two: the most recent leads, with '+N more'", /· \+\d+ more/.test(two), two);
  check("two: both rows have a dot", await B.evaluate(`!!${dotOf(N1)} && !!${dotOf(E1)}`));
  said = await announcedFor(B, E1_TITLE);
  check("announce: the second document once", said.length === 1, JSON.stringify(said));
  await B.tap(`document.querySelector('button[aria-label="Cards"]')`);
  await B.waitFor(`document.querySelector('button[aria-label="Cards"][aria-pressed="true"]')`, 5000);
  check("cards: the dot shows on the card", await B.evaluate(`!!${dotOf(E1)}`));
  await B.tap(`document.querySelector('button[aria-label="Rows"]')`);
  await B.waitFor(`document.querySelector('button[aria-label="Rows"][aria-pressed="true"]')`, 5000);
  taps = 0;
  await C.waitFor(`${BANNER_ID} === ${JSON.stringify(E1)}`, 8000);
  await tap(C, `${BANNER}.querySelector("a")`);
  const joined = await C.waitFor(`location.pathname === ${JSON.stringify(entryPath(E1))} && ${EDITOR}`, 15000)
    .then(() => true)
    .catch(() => false);
  check("join: 1 tap (Join) opens the entry", joined && taps === 1, `${taps} tap`);

  // -------------------------------------------------------------------------
  step("Who's typing, convergence and authorship (on the 2-tap event)");
  for (const p of [B, C]) {
    await visit(p, entryPath(E2));
    await p.waitFor(EDITOR, 15000);
  }
  await openFromTimeline(A, E2);
  await sleep(1000);
  check(
    "idle: no avatars on an entry nobody is editing",
    (await B.evaluate(`${AVATARS}.length`)) === 0 && (await C.evaluate(`${AVATARS}.length`)) === 0,
  );
  check(
    "viewer: read-only, plain time, no toolbar, title field, time chip or ⋯ menu, but Share",
    await C.evaluate(
      `${EDITOR}.getAttribute("contenteditable") === "false" && !${TOOLBAR} && !${TITLE} && !!${HEADER_TIME} && !${TIME_CHIP} && !${MENU} && !!${SHARE}`,
    ),
  );
  t0 = Date.now();
  await typeInEditor(A, ` ${tag}-e1`);
  await Promise.all([B.waitFor(hasAvatar(MEMBER), 8000), C.waitFor(hasAvatar(MEMBER), 8000)]);
  latency = Date.now() - t0;
  check("avatars: the others see the writer within ~2 s", latency <= 2500, `${latency} ms`);
  const label = await B.evaluate(
    `document.querySelector('main [data-region="editors"] [role="group"]')?.getAttribute("aria-label") ?? ""`,
  );
  check(
    "avatars: initials, and an accessible label",
    (await B.evaluate(`${AVATARS}[0]?.textContent`)) === initials(MEMBER_NAME) && /is editing$/.test(label),
    `${await B.evaluate(`${AVATARS}[0]?.textContent`)} / ${label}`,
  );
  check("avatars: the writer doesn't see themselves", (await A.evaluate(`${AVATARS}.length`)) === 0);
  await typeInEditor(B, ` ${tag}-b`);
  await A.waitFor(hasAvatar(CARETAKER), 8000);
  await C.waitFor(hasAvatar(CARETAKER), 8000);
  check(
    "avatars: the caretaker sees the member but not themselves",
    JSON.stringify(await B.evaluate(`${AVATARS}.map((el) => el.dataset.person)`)) ===
      JSON.stringify([MEMBER]),
  );
  const order = await C.evaluate(`${AVATARS}.map((el) => el.dataset.person)`);
  check(
    "avatars: the viewer sees both, most recent first, and never themselves",
    JSON.stringify(order) === JSON.stringify([CARETAKER, MEMBER]) && !order.includes(VIEWER),
    JSON.stringify(order),
  );
  const lat = [];
  for (let i = 1; i <= 3; i++) {
    const word = `${tag}-a${i}`;
    const t = Date.now();
    await typeInEditor(A, ` ${word}`);
    await B.waitFor(editorHas(word), 15000);
    lat.push(Date.now() - t);
    await C.waitFor(editorHas(word), 15000);
  }
  check("live: the others see the typing", true, `ms: ${lat.join(", ")}`);
  await newParagraph(A);
  await typeInEditor(A, `${tag} from A`);
  await typeInEditor(B, ` ${tag} from B`);
  for (const p of [A, B, C]) {
    await p.waitFor(`${editorHas(`${tag} from A`)} && ${editorHas(`${tag} from B`)}`, 15000);
  }
  await sleep(1500);
  const texts = await Promise.all([A, B, C].map((p) => p.evaluate(`${EDITOR}.textContent`)));
  check(
    "merge: concurrent edits converge on every device",
    texts.every((t) => t === texts[0]),
    texts[0].slice(-60),
  );
  // Burst until the server compacts (pending updates folded into the snapshot and deleted).
  const snapshotBefore = psql(`SELECT md5(coalesce(snapshot, '')) FROM note_document WHERE id = '${E2}'`);
  const compactedSql = `SELECT (SELECT count(*) FROM note_update WHERE document_id = '${E2}') = 0
       AND md5(coalesce(snapshot, '')) <> '${snapshotBefore}'
       AND editors ? '${MEMBER}' AND editors ? '${CARETAKER}' AND NOT editors ? '${VIEWER}'
     FROM note_document WHERE id = '${E2}'`;
  let compacted = psql(compactedSql);
  for (let i = 0; i < 40 && compacted !== "t"; i++) {
    await typeInEditor(A, ` w${i}`);
    await sleep(600);
    compacted = psql(compactedSql);
  }
  check("server: compacted, with both writers (and not the viewer) as editors", compacted === "t", compacted);
  await B.waitFor(
    `${localRows("SELECT count(*) AS n FROM note_update WHERE document_id = ?", [E2])}.then((r) => r[0].n === 0)`,
    15000,
  );
  check("avatars: the writer's avatar stays after compaction", await B.evaluate(hasAvatar(MEMBER)));
  await newParagraph(A);
  await A.press(`document.querySelector('[aria-label="Heading"]')`);
  await A.send("Input.insertText", { text: `${tag} Questions` });
  await C.waitFor(
    `[...document.querySelectorAll(".ProseMirror h2")].some((h) => h.textContent.includes("${tag} Questions"))`,
    15000,
  );
  check("format: a heading syncs as a heading", true);
  await A.screenshot("ln-writer");
  await C.screenshot("ln-viewer");

  // -------------------------------------------------------------------------
  step("Offline: editing, and a new note");
  // Offline, only in-app navigation works, and only to route modules this page
  // has already loaded (E2 was a full page load): visit the timeline first.
  await toTimeline(A);
  await A.press(`${rowOf(E2)}.querySelector('a[aria-label^="Open "]')`);
  await A.waitFor(
    `location.pathname === ${JSON.stringify(entryPath(E2))} && ${editorHas(`${tag} Questions`)}`,
    15000,
  );
  proxyA.setOnline(false);
  await A.waitFor(`document.body.textContent.includes("Offline")`, 20000).catch(() => undefined);
  const offWord = `${tag}-offline`;
  await newParagraph(A);
  await typeInEditor(A, offWord);
  await sleep(2500);
  check("offline: the edit shows locally", await A.evaluate(editorHas(offWord)));
  check("offline: the others don't have it yet", !(await B.evaluate(editorHas(offWord))));
  // In-app navigation only from here: a full page load needs the network.
  const offNote = `${tag}-offline-note`;
  await start(A, "Note");
  await A.send("Input.insertText", { text: offNote });
  await A.waitFor(ON_ENTRY, 5000);
  const NOFF = idFromPath(await A.evaluate("location.pathname"));
  made.push(NOFF);
  await sleep(500);
  await toTimeline(A);
  await A.waitFor(`${rowOf(NOFF)}?.textContent.includes(${JSON.stringify(offNote)})`, 10000);
  check("offline: the new note's row shows its unsynced text", true);
  await sleep(1500);
  check(
    "offline: not on the server yet",
    psql(`SELECT count(*) FROM timeline_entry WHERE id = '${NOFF}'`) === "0",
  );
  t0 = Date.now();
  proxyA.setOnline(true);
  await B.waitFor(editorHas(offWord), 30000);
  check("offline: the edit arrives after reconnecting", true, `${Date.now() - t0} ms`);
  await visit(B, TIMELINE);
  await B.waitFor(`${rowOf(NOFF)}?.textContent.includes(${JSON.stringify(offNote)})`, 30000);
  check("offline: the new note reaches another device", true, `${Date.now() - t0} ms`);
  const offStored = await waitForSql(
    `SELECT count(*) FROM timeline_entry e JOIN note_document d ON d.id = e.id WHERE e.id = '${NOFF}' AND e.body IS NULL AND e.deleted_at IS NULL`,
  );
  const offText = await waitForSql(
    `SELECT (SELECT count(*) FROM note_update WHERE document_id = '${NOFF}') + (SELECT count(*) FROM note_document WHERE id = '${NOFF}' AND text LIKE '%${offNote}%')`,
  );
  check(
    "offline: uploaded without rejection (entry, document and text)",
    offStored === "1" && offText !== "0",
    `${offStored}/${offText}`,
  );
  check("offline: still on the device that wrote it", await A.evaluate(`!!${rowOf(NOFF)}`));

  // -------------------------------------------------------------------------
  step("Expiry: avatars, banner and dots go about 2 minutes after the last edit");
  const live = [N1, E1, E2, NOFF];
  await visit(B, entryPath(E2));
  await B.waitFor(hasAvatar(MEMBER), 15000);
  await visit(C, TIMELINE);
  await C.waitFor(`${JSON.stringify(live)}.includes(${BANNER_ID}) && ${dotOf(E2)}`, 15000);
  // Just inside the 2-minute window: they must stay for now, then go on the timer with no new rows.
  backdate(live, 105);
  const movedAt = Date.now();
  await Promise.all([B, C].map((p) => p.waitFor(editsOlderThan(live, 100000), 15000)));
  check(
    "expiry: still shown while inside the window",
    (await B.evaluate(hasAvatar(MEMBER))) && (await C.evaluate(`!!${dotOf(E2)}`)),
  );
  const goneOnC = `!${JSON.stringify(live)}.includes(${BANNER_ID}) && ${live.map((id) => `!${dotOf(id)}`).join(" && ")}`;
  await Promise.all([B.waitFor(`${AVATARS}.length === 0`, 45000), C.waitFor(goneOnC, 45000)]);
  const gone = Date.now() - movedAt;
  // Due 15 s after the move; the 15 s tick adds up to 15 s more.
  check("expiry: avatars, banner and dots go on the timer", gone >= 12000 && gone <= 40000, `${gone} ms`);
  check(
    "expiry: the status region no longer announces them",
    await C.evaluate(`!!${BANNER} || ${STATUS}.textContent === ""`),
  );
  check("expiry: the text is untouched", await B.evaluate(editorHas(`${tag}-e1`)));

  // -------------------------------------------------------------------------
  step("Header: the time chip and Delete");
  await start(A, "Note");
  check("time: writers get the chip on a draft", await A.evaluate(`!!${TIME_CHIP}`));
  const startMs = await headerTimeMs(A);
  await shiftDay(A, -2);
  const pickedMs = await headerTimeMs(A);
  check(
    "time: the chip shows the picked time, and that alone saves nothing",
    pickedMs === startMs - 2 * DAY_MS && (await A.evaluate(ON_DRAFT)),
    `${(pickedMs - startMs) / DAY_MS} days`,
  );
  await A.evaluate(`${EDITOR}.focus()`);
  await A.send("Input.insertText", { text: `${tag} written later` });
  await A.waitFor(ON_ENTRY, 5000);
  const N4 = idFromPath(await A.evaluate("location.pathname"));
  made.push(N4);
  const occurredMs = () =>
    Number(
      psql(
        `SELECT (extract(epoch FROM occurred_at) * 1000)::bigint FROM timeline_entry WHERE id = '${N4}'`,
      ) || 0,
    );
  await waitForSql(`SELECT count(*) FROM timeline_entry WHERE id = '${N4}'`, (r) => r === "1");
  check(
    "time: a time picked before typing is the saved occurredAt",
    Math.abs(occurredMs() - pickedMs) < 1000,
    new Date(occurredMs()).toISOString(),
  );
  await visit(B, TIMELINE);
  await B.waitFor(dayOfRow(N4), 15000);
  const dayBefore = await B.evaluate(dayOfRow(N4));
  await visit(C, entryPath(N4));
  await C.waitFor(editorHas(`${tag} written later`), 15000);
  // Move it a day later through the chip's calendar (a nested popover).
  const movedMs = pickedMs + DAY_MS;
  const target = await A.evaluate(`(() => { const d = new Date(${movedMs});
    return { day: String(d.getDate()), heading: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }) }; })()`);
  await A.press(TIME_CHIP);
  await A.waitFor(PICK_DATE, 5000);
  await A.tap(PICK_DATE);
  await A.waitFor(CAL_GRID, 5000);
  await escape(A);
  await A.waitFor(`!${CAL_GRID}`, 3000);
  check("time: Escape closes the calendar, not the chip's popover", await A.evaluate(`!!${DAY_SEGMENT}`));
  await A.tap(PICK_DATE);
  await A.waitFor(CAL_GRID, 5000);
  if ((await A.evaluate(CAL_HEADING)) !== target.heading) await A.press(NEXT_MONTH);
  await A.waitFor(`${CAL_HEADING} === ${JSON.stringify(target.heading)}`, 3000);
  await A.tap(calDay(target.day));
  await A.waitFor(`!${CAL_GRID}`, 3000);
  await sleep(1500);
  check(
    "time: picking a day closes the calendar; the chip stays open and nothing is saved yet",
    (await A.evaluate(`!!${DAY_SEGMENT}`)) && Math.abs(occurredMs() - pickedMs) < 1000,
    new Date(occurredMs()).toISOString(),
  );
  await A.press(button("Done"));
  await A.waitFor(`!${DAY_SEGMENT}`, 5000);
  await waitForSql(
    `SELECT (extract(epoch FROM occurred_at) * 1000)::bigint FROM timeline_entry WHERE id = '${N4}'`,
    (r) => Math.abs(Number(r) - movedMs) < 1000,
  );
  check("time: the change reaches Postgres", Math.abs(occurredMs() - movedMs) < 1000);
  await B.waitFor(`${dayOfRow(N4)} === "Yesterday"`, 15000);
  check("time: another member's timeline moves the row", true, `${dayBefore} → Yesterday`);
  await C.waitFor(`Math.abs(new Date(${HEADER_TIME}.dateTime) - ${movedMs}) < 1000`, 15000);
  check("time: a viewer on the page sees the new time", true);
  await visit(B, entryPath(N4));
  await B.waitFor(editorHas(`${tag} written later`), 15000);
  await A.press(MENU);
  await A.waitFor(menuItem("Delete"), 5000);
  await A.press(menuItem("Delete"));
  await A.waitFor(`document.querySelector("dialog[open]")`, 5000);
  check(
    "delete: asks first",
    await A.evaluate(`document.querySelector("dialog[open]").textContent.includes("Delete this note?")`),
  );
  await A.press(dialogButton("Cancel"));
  await A.waitFor(`!document.querySelector("dialog[open]")`, 5000);
  await sleep(500);
  check(
    "delete: Cancel keeps it",
    await A.evaluate(`location.pathname === ${JSON.stringify(entryPath(N4))} && !!${MENU}`),
  );
  await A.press(MENU);
  await A.waitFor(menuItem("Delete"), 5000);
  await A.press(menuItem("Delete"));
  await A.waitFor(`document.querySelector("dialog[open]")`, 5000);
  await A.press(dialogButton("Delete"));
  await A.waitFor(`location.pathname === ${JSON.stringify(TIMELINE)}`, 10000);
  check("delete: back to the timeline, and the row is gone", await A.evaluate(`!${rowOf(N4)}`));
  check(
    "delete: soft-deleted in Postgres",
    (await waitForSql(
      `SELECT (deleted_at IS NOT NULL)::text FROM timeline_entry WHERE id = '${N4}'`,
      (r) => r === "true",
    )) === "true",
  );
  await B.waitFor(bodyHas("This entry was deleted."), 15000);
  await C.waitFor(bodyHas("This entry was deleted."), 15000);
  check("delete: others on the page (writer and viewer) see the deleted state", true);

  // -------------------------------------------------------------------------
  step("Share");
  const link = BASE + entryPath(N1);
  await visit(A, entryPath(N1));
  await A.waitFor(`${SHARE} && ${editorHas(`${tag} first words`)}`, 15000);
  await A.press(SHARE);
  await A.waitFor(bodyHas("Link copied"), 5000);
  const copied = await A.evaluate(`navigator.clipboard.readText()`);
  check("share: without a share sheet, it copies the entry's web URL", copied === link, copied);
  await A.waitFor(`!${bodyHas("Link copied")}`, 6000);
  check("share: the confirmation goes away", true);
  await visit(C, entryPath(N1));
  await C.waitFor(`${SHARE} && ${bodyHas("You can view this")}`, 15000);
  await C.press(SHARE);
  await C.waitFor(`window.__shared.length === 1`, 5000);
  const shared = await C.evaluate(`window.__shared[0]`);
  check(
    "share: a viewer's share sheet gets the title and web URL",
    shared.title === N1_TITLE && shared.url === link,
    JSON.stringify(shared),
  );
  check("share: no 'Link copied' when the sheet took it", !(await C.evaluate(bodyHas("Link copied"))));

  // -------------------------------------------------------------------------
  step("The sheet, sign-in and 404s");
  await visit(B, TIMELINE);
  await B.waitFor(`${ROWS} > 0`, 15000);
  await B.press(tile("Symptom"));
  await B.waitFor(`document.querySelector("[role=dialog] form")`);
  check(
    "sheet: only Symptom and Vitals (notes and events have their own page)",
    await B.evaluate(
      `(() => { const kinds = [...document.querySelectorAll('[role=dialog] fieldset .join > *')].map((el) => el.getAttribute("aria-label") ?? el.textContent.trim());
        return JSON.stringify(kinds) === JSON.stringify(["Symptom", "Vitals ▾"]); })()`,
    ),
  );
  await escape(B);
  const symptomId = psql(
    `SELECT id FROM timeline_entry WHERE group_id = '${GROUP}' AND kind = 'symptom' AND deleted_at IS NULL LIMIT 1`,
  );
  // Through `visit`: after a reset, this load is the one that most often hits
  // the stale-KID 401, and the 404 then waits (blank) on the first sync.
  await visit(B, entryPath(symptomId));
  await B.waitFor(bodyHas("Not found"), 20000);
  check("404: a symptom id isn't an entry page", true);
  await D.send("Page.navigate", { url: copied });
  await D.waitFor(`location.pathname === "/sign-in" && location.search.includes("redirectTo")`, 15000);
  check(
    "signed out: the link asks to sign in, and shows nothing of the note",
    !(await D.evaluate(bodyHas(tag))),
  );
  await D.type(`document.querySelector('input[name="email"]')`, "caretaker@example.com");
  await D.type(`document.querySelector('input[name="password"]')`, PW);
  await D.press(`document.querySelector('form button[type="submit"]')`);
  await D.waitFor(
    `location.pathname === ${JSON.stringify(entryPath(N1))} && ${editorHas(`${tag} first words`)}`,
    20000,
  );
  check("signed out: after signing in, the link lands on the entry", true);
  await D.signOut();
  await D.waitFor(`location.pathname === "/sign-in" || location.pathname === "/"`, 15000);
  await D.signIn("admin@example.com", PW);
  await D.send("Page.navigate", { url: copied });
  await D.waitFor(bodyHas("Not found"), 20000);
  await sleep(500);
  check(
    "404: a non-member sees Not found, with no title, text or Share",
    await D.evaluate(
      `![document.title, document.body.textContent].join(" ").includes(${JSON.stringify(tag)}) && !${SHARE}`,
    ),
  );

  // Known noise: the proxied browser can't reach Vite's HMR websocket (dev
  // only); PowerSync reports the sync error while that browser is offline,
  // can fail its first connect (a 401 while it refetches the JWKS after a
  // reset), and warns when a full page load closes the previous page's
  // database; and the 404 steps log their Not found.
  const noise =
    /401|Failed to load resource|\[vite\] failed to connect|Failed to send error to Vite|\[PowerSync\]: Sync error|\[PowerSync\]: Initial connect attempt|error closing database connection|\[PowerSync\]: Sync aborted|Error: Not found|status: 404|ErrorResponse/;
  const errors = pages.flatMap((p) => p.errors).filter((e) => !noise.test(e));
  check("no console errors or warnings", errors.length === 0, errors.slice(0, 5).join(" | "));
} catch (e) {
  check("run", false, e.message);
  for (const p of pages) {
    const where = await p
      .evaluate(`location.pathname + " | " + document.body.innerText.slice(0, 300)`)
      .catch(() => "?");
    console.log("  page:", where.replace(/\n+/g, " / "));
    console.log("  errors:", p.errors.slice(0, 8).join(" | "));
  }
} finally {
  for (const b of [bA, bB, bC, bD]) b.proc.kill();
  proxyA.close?.();
  // Tidy up: the next run (and phase2.mjs) starts from the seeds' timeline.
  if (made.length) {
    try {
      psql(
        `UPDATE timeline_entry SET deleted_at = now() WHERE id IN (${inList(made)}) AND deleted_at IS NULL`,
      );
    } catch (e) {
      console.log("cleanup failed:", e.message);
    }
  }
}
const failed = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} passed in ${Math.round((Date.now() - started) / 1000)} s`,
);
process.exit(failed.length ? 1 : 0);
