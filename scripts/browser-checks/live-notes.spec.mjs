// Live notes end to end: what needs real devices, the server and PowerSync.
// Notes and events are their live document (the live notes UX PRD). member@
// starts a note and an event in two taps each (the header's +, then the
// kind), and they upload as the member (a null body, the document, "Event"
// for an unnamed event); a rename reaches the viewer; Live now from another
// device (the banner and dot on two other devices, Join in one tap); who's
// typing across three devices (avatars, live typing, concurrent edits
// converging, compaction, a heading); offline then reconnect (an edit, a new
// note, an appointment's place and all day); a time change and a delete
// reaching the others; and a shared link opened signed out.
//
// Everything a single device decides (drafts that write nothing, the URL
// replace, title chips, the time chip and its calendar, Delete's confirm,
// Share, 404s, the viewer's read-only page, avatars' order, the banner's
// wording, the dot, announcements, expiry, appointment details) is component
// tests on the test device: apps/web/app/routes/app/groups/entry/entry.browser.test.tsx
// and timeline/timelineStrips.browser.test.tsx.
//
// Self-contained and order-independent: every step makes its own fresh,
// uniquely titled entries and asserts relative to them, never to global idle
// state or seed order. Before the Live now steps it moves its own documents'
// edit times back an hour in Postgres (`quiet`), so they're idle whatever ran
// before. At the end it soft-deletes what it made, so it passes run after
// run without a `pnpm datastore:reset`.
//
// Four browsers in Dev Family: member@ (owner, through a switchable proxy for
// the offline steps), caretaker@, viewer@, and a fresh one that starts signed
// out (then signs in as caretaker@). The smoke run (`--smoke`) is member@'s
// core path only: a note in 2 taps (+, Note), saved on the first keystroke,
// and an event in 2 taps, saved as "Event" (one browser, online).
//
// One test, in the old script's order: the devices and the entries each step
// makes are the state the next one builds on.
import {
  BASE,
  DEV_FAMILY as GROUP,
  DEV_FAMILY_TIMELINE as TIMELINE,
  PASSWORD,
  SMOKE,
  expect,
  psql,
  signIn,
  test,
  waitFor,
} from "./fixtures.mjs";

const started = Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** An assertion that is its own reported step (one old PASS line). */
const check = (name, ok, detail = "") =>
  test.step(name, () => {
    expect(ok, detail).toBe(true);
  });
const section = (title) => console.log(`\n# ${title}  [${Math.round((Date.now() - started) / 1000)} s]`);
/** Poll Postgres until `holds(result)` (default: not "", "0" or "f"). */
const waitForSql = async (sql, holds = (r) => r && r !== "0" && r !== "f", ms = 15_000) => {
  const end = Date.now() + ms;
  let last = "";
  while (Date.now() < end) {
    last = psql(sql);
    if (holds(last)) return last;
    await sleep(300);
  }
  return last;
};
const inList = (ids) => ids.map((id) => `'${id}'`).join(",");
const wf = (page, expr, timeout = 10_000) => waitFor(page, expr, { timeout });
const waits = (page, expr, timeout) =>
  wf(page, expr, timeout).then(
    () => true,
    () => false,
  );
/** React Aria buttons and menu items need pointer events before click. */
const press = (page, expr) =>
  page.evaluate(`(() => { const el = ${expr}; if (!el) throw new Error("no element: " + ${JSON.stringify(expr)});
    el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })); el.click(); return true; })()`);

// ---- Selectors ---------------------------------------------------------------
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const ON_ENTRY = `/\\/entries\\/${UUID}$/.test(location.pathname)`;
const ON_DRAFT = `location.pathname.endsWith("/entries/new")`;
const TIMELINE_LINK = `[...document.querySelectorAll("main a")].find((a) => a.textContent.trim() === "Timeline")`;
const ADD_BUTTON = `document.querySelector('main [data-day-header] button[aria-label="Add to Today"]')`;
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
const TIME_CHIP = `document.querySelector('main header button[aria-label="Change when it happened"]')`;
const HEADER_TIME = `document.querySelector("main header time")`;
const DAY_SEGMENT = `document.querySelector('[role=dialog] [data-type="day"]')`;
const MENU = `document.querySelector('main header [data-region="actions"] button[aria-label^="Actions for"]')`;
const AVATARS = `[...document.querySelectorAll('main [data-region="editors"] [data-person]')]`;
const hasAvatar = (id) => `${AVATARS}.some((el) => el.dataset.person === ${JSON.stringify(id)})`;
const BANNER = `document.querySelector('main section[aria-label="Live now"]')`;
const BANNER_ID = `(${BANNER}?.dataset.liveBanner ?? null)`;
const ROWS = `document.querySelectorAll("main ol > li").length`;
const rowOf = (id) => `document.querySelector('main ol > li a[href$="/entries/${id}"]')?.closest("li")`;
const dotOf = (id) => `${rowOf(id)}?.querySelector("[data-live-dot]")`;
const dayOfRow = (id) => `(${rowOf(id)}?.closest("section")?.querySelector("h3")?.textContent ?? null)`;
const localRows = (sql, params = []) =>
  `window.caretookSync.powersync.getAll(${JSON.stringify(sql)}, ${JSON.stringify(params)})`;
const entryPath = (id) => `/app/groups/${GROUP}/entries/${id}`;
const idFromPath = (path) => path.split("/").at(-1);

// ---- Input -------------------------------------------------------------------
/** Real taps are counted, for the tap-count checks. */
let taps = 0;
/**
 * A real tap (mouse press and release) at the centre of an element, after
 * scrolling it into view and waiting until it has stopped moving (content
 * arriving above it can shift it): it goes through whatever is on top, as a
 * finger would.
 */
async function tap(page, expr, { count = true } = {}) {
  const where = `(() => { const el = ${expr}; if (!el) return null;
    el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`;
  let point = await page.evaluate(where);
  if (!point) throw new Error(`nothing to tap: ${expr}`);
  for (let i = 0; i < 20; i++) {
    await sleep(100);
    const next = await page.evaluate(where);
    if (!next) throw new Error(`nothing to tap: ${expr}`);
    const still = next.x === point.x && next.y === point.y;
    point = next;
    if (still) break;
  }
  await page.mouse.click(point.x, point.y);
  if (count) taps++;
}
/** Type into the editor as a person would: focus the end, then insert text. */
async function typeInEditor(page, text) {
  await page.evaluate(`(() => { const el = ${EDITOR}; el.focus();
    const sel = getSelection(); sel.selectAllChildren(el); sel.collapseToEnd(); return true; })()`);
  await page.keyboard.insertText(text);
}
const newParagraph = (page) => page.keyboard.press("Enter");
const setTitle = async (page, value) => {
  await page.evaluate(`${TITLE}.focus()`);
  await page.locator("main header input").first().fill(value);
};
const blurTitle = (page) => page.evaluate(`${TITLE}.blur()`);

/**
 * A full page load, then wait for PowerSync to connect: each load connects
 * afresh, and right after a reset that first connect can fail on a 401 while
 * PowerSync refetches the JWKS, retrying a few seconds later. Uploads wait
 * for it too, so timed steps start only once it's up.
 */
async function visit(page, path) {
  const CONNECTED = `window.caretookSync?.powersync.currentStatus.connected`;
  await page.goto(path);
  // Seen after a reset: PowerSync keeps refusing one page's token ("no key
  // matched the token KID") while other pages connect. Load it once more.
  if (!(await waits(page, CONNECTED, 15_000))) {
    console.log(`  (${path}: PowerSync didn't connect in 15 s; loading it again)`);
    await page.goto(path);
    await wf(page, CONNECTED, 30_000);
  }
}
/**
 * Open an entry from the timeline in the app, as a person would. The page
 * keeps its database and sync stream, so a timed step right after doesn't
 * wait on a fresh connect (which a full page load needs).
 */
async function openFromTimeline(page, id) {
  await toTimeline(page);
  await wf(page, rowOf(id));
  await press(page, `${rowOf(id)}.querySelector('a[aria-label^="Open "]')`);
  await wf(page, `location.pathname === ${JSON.stringify(entryPath(id))} && ${EDITOR}`, 15_000);
}
/** In-app navigation back to the timeline (works offline, unlike a page load). */
async function toTimeline(page) {
  if (!(await page.evaluate(`location.pathname === ${JSON.stringify(TIMELINE)}`)))
    await press(page, TIMELINE_LINK);
  await wf(page, `location.pathname === ${JSON.stringify(TIMELINE)} && ${ROWS} > 0`, 15_000);
}
/** From the timeline, tap Event (or Note): the draft opens with the cursor in its document. */
async function start(page, kind) {
  await toTimeline(page);
  // Two taps: the header's +, then the kind.
  await wf(page, ADD_BUTTON);
  await tap(page, ADD_BUTTON);
  // A tap that lands while a menu is still closing doesn't open it (seen at load 40): once more, not counted.
  if (!(await waits(page, menuItem(kind), 3000))) await tap(page, ADD_BUTTON, { count: false });
  await wf(page, menuItem(kind), 5000);
  await tap(page, menuItem(kind));
  await wf(page, `${ON_DRAFT} && ${EDITOR_FOCUSED}`, 15_000);
}
/** Open the time chip, move the day by `steps` (negative = earlier), then Done. */
async function shiftDay(page, steps) {
  await press(page, TIME_CHIP);
  await wf(page, DAY_SEGMENT, 5000);
  await page.evaluate(`${DAY_SEGMENT}.focus()`);
  for (let i = 0; i < Math.abs(steps); i++) await page.keyboard.press(steps < 0 ? "ArrowDown" : "ArrowUp");
  await press(page, button("Done"));
  await wf(page, `!${DAY_SEGMENT}`, 5000);
}
const headerTimeMs = (page) => page.evaluate(`new Date(${HEADER_TIME}.dateTime).getTime()`);
const DAY_MS = 86_400_000;

/**
 * Wait for `ready`, then make sure the page doesn't reload under us: on a
 * fresh dev server, the first visit to a route can make Vite re-optimise
 * its dependencies and reload the page.
 */
async function settle(page, ready) {
  await wf(page, ready, 30_000);
  // A check build has no Vite client, so nothing to reload the page.
  if (!(await page.evaluate(`!!document.querySelector('script[src*="/@vite/client"]')`))) return;
  await page.evaluate("window.__settled = true");
  await sleep(1500);
  if (!(await page.evaluate("window.__settled === true").catch(() => false))) await wf(page, ready, 30_000);
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
    await Promise.all(observers.map((page) => wf(page, editsOlderThan(ids, 3_000_000), 15_000)));
    await sleep(1000);
    const still = await Promise.all(observers.map((page) => page.evaluate(editsOlderThan(ids, 3_000_000))));
    if (still.every(Boolean)) return;
  }
  throw new Error("couldn't quiet the check's documents");
}

const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

// Known noise: PowerSync reports the sync error while the proxied browser is
// offline, can fail its first connect (a 401 while it refetches the JWKS after
// a reset), and warns when a full page load closes the previous page's
// database; and the 404 steps log their Not found.
const NOISE =
  /401|Failed to load resource|\[vite\] failed to connect|Failed to send error to Vite|\[PowerSync\]: Sync error|\[PowerSync\]: Initial connect attempt|error closing database connection|\[PowerSync\]: Sync aborted|Error: Not found|status: 404|ErrorResponse/;

test(
  "notes and events across devices: typing, Live now, offline, time, delete, the link",
  { tag: "@smoke" },
  async ({ device }) => {
    test.setTimeout(190_000);
    const user = (email) => psql(`SELECT id || '|' || name FROM "user" WHERE email = '${email}'`).split("|");
    const [MEMBER, MEMBER_NAME] = user("member@example.com");
    const [CARETAKER] = user("caretaker@example.com");
    const [VIEWER] = user("viewer@example.com");
    const tag = `LN-${Date.now().toString(36)}`;
    /** Every entry this run makes: soft-deleted at the end. */
    const made = [];

    // Smoke runs member@ alone.
    const dA = await device("member", { offlineable: true });
    const dB = SMOKE ? null : await device("caretaker");
    const dC = SMOKE ? null : await device("viewer");
    const dD = SMOKE ? null : await device("fresh");
    const [A, B, C, D] = [dA.page, dB?.page, dC?.page, dD?.page];

    try {
      section("Sign in, and warm the routes");
      const members = [A, B, C].filter(Boolean);
      // caretaker@ (not proxied) visits the timeline and the editor first, so a
      // Vite re-optimise reload on a fresh dev server happens here, not mid-step
      // (settle() returns at once on a check build).
      if (B) {
        await signIn(B, "caretaker@example.com");
        await visit(B, TIMELINE);
        await settle(B, `${ROWS} > 0`);
        await visit(B, `/app/groups/${GROUP}/entries/new?kind=note`);
        await settle(B, EDITOR);
      }
      await signIn(A, "member@example.com");
      if (C) await signIn(C, "viewer@example.com");
      for (const page of members) {
        await visit(page, TIMELINE);
        await settle(page, `${ROWS} > 0`);
      }
      // Right after a reset, PowerSync's first connect can fail on a 401 while it
      // refetches the regenerated JWKS, and retries a few seconds later: wait
      // until every device is connected, so the timed steps don't measure that.
      await Promise.all(
        members.map((page) => wf(page, `window.caretookSync?.powersync.currentStatus.connected`, 30_000)),
      );
      // The one reload the warm-up is for, if it happened, isn't an error.
      const warmNoise = /Error loading route module|Failed to fetch dynamically imported module/;
      for (const d of [dA, dB, dC].filter(Boolean))
        d.errors.splice(0, d.errors.length, ...d.errors.filter((e) => !warmNoise.test(e)));
      await check(`setup: ${members.length === 3 ? "three members see" : "member@ sees"} the timeline`, true);

      // -------------------------------------------------------------------------
      section("Note: two taps, saved on the first keystroke, uploaded as the member");
      taps = 0;
      await start(A, "Note");
      await check(
        "note: typing after 2 taps (+, Note), with the cursor in the document",
        taps === 2,
        `${taps} tap`,
      );
      await A.keyboard.insertText(`${tag} first words`);
      await wf(A, ON_ENTRY, 5000);
      const N1 = idFromPath(await A.evaluate("location.pathname"));
      made.push(N1);
      await check("note: the first keystroke replaces the URL with the entry's", true, entryPath(N1));
      const N1_TITLE = `${tag} Morning`;
      await setTitle(A, N1_TITLE);
      await blurTitle(A);
      const stored = await waitForSql(
        `SELECT e.kind || '|' || coalesce(e.body, 'NULL') || '|' || coalesce(e.title, '') || '|' || u.email FROM timeline_entry e JOIN "user" u ON u.id = e.created_by JOIN note_document d ON d.id = e.id WHERE e.id = '${N1}'`,
        (r) => r.includes(N1_TITLE),
      );
      await check(
        "note: in Postgres with a null body, its document and its title, as the member",
        stored === `note|NULL|${N1_TITLE}|member@example.com`,
        stored,
      );
      const n1Authors = await waitForSql(
        `SELECT coalesce((SELECT string_agg(DISTINCT u.email, ',') FROM note_update n JOIN "user" u ON u.id = n.created_by WHERE n.document_id = '${N1}'), (SELECT CASE WHEN snapshot IS NOT NULL THEN 'compacted' END FROM note_document WHERE id = '${N1}'), '')`,
      );
      await check(
        "note: edits stored as the member",
        n1Authors === "member@example.com" || n1Authors === "compacted",
        n1Authors,
      );
      if (!SMOKE) {
        await test.step("note: the viewer's row shows the document as its body, and the title", async () => {
          // The text and the title sync as separate writes (the document, then the
          // entry's rename), so wait for both, not for the text alone.
          const both = `(${rowOf(N1)}?.textContent ?? "")`;
          const has = (t) => `${both}.includes(${JSON.stringify(t)})`;
          const seen = await waits(C, `${has(`${tag} first words`)} && ${has(N1_TITLE)}`, 20_000);
          expect(seen, await C.evaluate(`${both}.slice(0, 160)`)).toBe(true);
        });
      }

      // -------------------------------------------------------------------------
      section('Event: two taps; an unnamed event is saved as "Event"');
      taps = 0;
      await start(A, "Event");
      await check("event: typing after 2 taps (+, Event)", taps === 2, `${taps} tap`);
      await A.keyboard.insertText(`${tag} event start`);
      await wf(A, ON_ENTRY, 10_000);
      const E1 = idFromPath(await A.evaluate("location.pathname"));
      made.push(E1);
      await wf(A, `${TITLE}?.placeholder === "Add a title" && ${TITLE}.value === ""`, 10_000);
      const e1Saved = await waitForSql(
        `SELECT title || '|' || coalesce(body, 'null') FROM timeline_entry WHERE id = '${E1}'`,
        (r) => r === "Event|null",
      );
      await check(
        'event: in Postgres as "Event", with no body, and an "Add a title" prompt',
        e1Saved === "Event|null",
        e1Saved,
      );

      // Smoke stops here: the rest needs the other members' devices.
      if (!SMOKE) {
        // -----------------------------------------------------------------------
        section("A rename reaches the viewer");
        await wf(C, `${rowOf(E1)}?.textContent.includes(${JSON.stringify(`${tag} event start`)})`, 20_000);
        await press(C, `${rowOf(E1)}.querySelector('a[aria-label^="Open "]')`);
        await wf(C, editorHas(`${tag} event start`), 15_000);
        const E1_TITLE = `${tag} Dr. Lee visit`;
        await setTitle(A, E1_TITLE);
        await blurTitle(A);
        await wf(C, `${HEADER}?.textContent.includes(${JSON.stringify(E1_TITLE)})`, 15_000);
        const e1Stored = await waitForSql(
          `SELECT title || '|' || coalesce(body, 'null') FROM timeline_entry WHERE id = '${E1}'`,
          (r) => r.startsWith(E1_TITLE),
        );
        await check(
          "event: a typed rename reaches the viewer and Postgres",
          e1Stored === `${E1_TITLE}|null`,
          e1Stored,
        );

        // -----------------------------------------------------------------------
        section("Live now from another device: the banner, the dot and Join");
        await quiet([N1, E1], [B, C]);
        for (const page of [B, C]) {
          await visit(page, TIMELINE);
          await wf(page, `${rowOf(N1)} && ${rowOf(E1)}`, 20_000);
        }
        const ours = JSON.stringify([N1, E1]);
        await check(
          "idle: no live dot on the check's entries, and the banner isn't for them",
          await B.evaluate(`!${dotOf(N1)} && !${dotOf(E1)} && !${ours}.includes(${BANNER_ID})`),
        );
        await openFromTimeline(A, N1);
        let t0 = Date.now();
        await typeInEditor(A, ` ${tag}-live1`);
        await Promise.all(
          [B, C].map((page) => wf(page, `${BANNER_ID} === ${JSON.stringify(N1)} && ${dotOf(N1)}`, 15_000)),
        );
        let latency = Date.now() - t0;
        // ~0.5–2 s on a quiet machine; the bound allows for a shared one (B-110).
        await check(
          "appear: banner and dot on two other devices within a few seconds",
          latency <= 6000,
          `${latency} ms`,
        );
        const bannerText = await B.evaluate(`${BANNER}.innerText.replace(/\\s+/g, " ").trim()`);
        await check(
          "banner: '<name> is writing · <title> · Join'",
          bannerText.startsWith(`${MEMBER_NAME} is writing · ${N1_TITLE}`) && bannerText.endsWith("Join"),
          bannerText,
        );
        taps = 0;
        await tap(C, `${BANNER}.querySelector("a")`);
        const joined = await waits(
          C,
          `location.pathname === ${JSON.stringify(entryPath(N1))} && ${EDITOR}`,
          15_000,
        );
        await check("join: 1 tap (Join) opens the entry", joined && taps === 1, `${taps} tap`);

        // -----------------------------------------------------------------------
        section("Who's typing, convergence and authorship");
        await visit(B, entryPath(N1));
        await wf(B, EDITOR, 15_000);
        t0 = Date.now();
        await typeInEditor(A, ` ${tag}-e1`);
        await Promise.all([wf(B, hasAvatar(MEMBER), 15_000), wf(C, hasAvatar(MEMBER), 15_000)]);
        latency = Date.now() - t0;
        await check(
          "avatars: the others see the writer within a few seconds",
          latency <= 6000,
          `${latency} ms`,
        );
        await check(
          "avatars: initials",
          (await B.evaluate(`${AVATARS}[0]?.textContent`)) === initials(MEMBER_NAME),
          await B.evaluate(`${AVATARS}[0]?.textContent`),
        );
        await check(
          "avatars: the writer doesn't see themselves",
          (await A.evaluate(`${AVATARS}.length`)) === 0,
        );
        // The member's edits upload first (their device is behind a proxy, B-110), so the caretaker's are the most recent.
        // The editor writes a burst 250 ms after the last keystroke (at most 1 s), so wait that out first: an
        // earlier edit's avatar (within its 2 minutes) can satisfy the wait above at once, and an empty queue
        // then only means the burst isn't written yet.
        await sleep(1200);
        await wf(A, `${localRows("SELECT count(*) AS n FROM ps_crud")}.then((r) => r[0].n === 0)`, 15_000);
        await typeInEditor(B, ` ${tag}-b`);
        await wf(A, hasAvatar(CARETAKER), 15_000);
        await wf(C, hasAvatar(CARETAKER), 15_000);
        await check(
          "avatars: the caretaker sees the member but not themselves",
          JSON.stringify(await B.evaluate(`${AVATARS}.map((el) => el.dataset.person)`)) ===
            JSON.stringify([MEMBER]),
        );
        const order = await C.evaluate(`${AVATARS}.map((el) => el.dataset.person)`);
        await check(
          "avatars: the viewer sees both, most recent first, and never themselves",
          JSON.stringify(order) === JSON.stringify([CARETAKER, MEMBER]) && !order.includes(VIEWER),
          JSON.stringify(order),
        );
        const lat = [];
        for (let i = 1; i <= 3; i++) {
          const word = `${tag}-a${i}`;
          const t = Date.now();
          await typeInEditor(A, ` ${word}`);
          await wf(B, editorHas(word), 15_000);
          lat.push(Date.now() - t);
          await wf(C, editorHas(word), 15_000);
        }
        await check("live: the others see the typing", true, `ms: ${lat.join(", ")}`);
        await newParagraph(A);
        await typeInEditor(A, `${tag} from A`);
        await typeInEditor(B, ` ${tag} from B`);
        for (const page of [A, B, C]) {
          await wf(page, `${editorHas(`${tag} from A`)} && ${editorHas(`${tag} from B`)}`, 15_000);
        }
        await sleep(1500);
        const texts = await Promise.all([A, B, C].map((page) => page.evaluate(`${EDITOR}.textContent`)));
        await check(
          "merge: concurrent edits converge on every device",
          texts.every((t) => t === texts[0]),
          texts[0].slice(-60),
        );
        // Burst until the server compacts (pending updates folded into the snapshot and deleted).
        const snapshotBefore = psql(
          `SELECT md5(coalesce(snapshot, '')) FROM note_document WHERE id = '${N1}'`,
        );
        const compactedSql = `SELECT (SELECT count(*) FROM note_update WHERE document_id = '${N1}') = 0
       AND md5(coalesce(snapshot, '')) <> '${snapshotBefore}'
       AND editors ? '${MEMBER}' AND editors ? '${CARETAKER}' AND NOT editors ? '${VIEWER}'
     FROM note_document WHERE id = '${N1}'`;
        let compacted = psql(compactedSql);
        for (let i = 0; i < 40 && compacted !== "t"; i++) {
          await typeInEditor(A, ` w${i}`);
          await sleep(600);
          compacted = psql(compactedSql);
        }
        await check(
          "server: compacted, with both writers (and not the viewer) as editors",
          compacted === "t",
          compacted,
        );
        await wf(
          B,
          `${localRows("SELECT count(*) AS n FROM note_update WHERE document_id = ?", [N1])}.then((r) => r[0].n === 0)`,
          15_000,
        );
        await check(
          "avatars: the writer's avatar stays after compaction",
          await B.evaluate(hasAvatar(MEMBER)),
        );
        await newParagraph(A);
        await press(A, `document.querySelector('[aria-label="Heading"]')`);
        await A.keyboard.insertText(`${tag} Questions`);
        await wf(
          C,
          `[...document.querySelectorAll(".ProseMirror h2")].some((h) => h.textContent.includes("${tag} Questions"))`,
          15_000,
        );
        await check("format: a heading syncs as a heading", true);

        // -----------------------------------------------------------------------
        section("Offline, then reconnect: an edit and a new note");
        // Offline, only in-app navigation works, and only to route modules this page
        // has already loaded: through the timeline.
        await toTimeline(A);
        await press(A, `${rowOf(N1)}.querySelector('a[aria-label^="Open "]')`);
        await wf(
          A,
          `location.pathname === ${JSON.stringify(entryPath(N1))} && ${editorHas(`${tag} Questions`)}`,
          15_000,
        );
        dA.offline(true);
        await waits(A, `document.body.textContent.includes("Offline")`, 20_000);
        const offWord = `${tag}-offline`;
        await newParagraph(A);
        await typeInEditor(A, offWord);
        await sleep(2500);
        await check("offline: the edit shows locally", await A.evaluate(editorHas(offWord)));
        await check("offline: the others don't have it yet", !(await B.evaluate(editorHas(offWord))));
        const offNote = `${tag}-offline-note`;
        await start(A, "Note");
        await A.keyboard.insertText(offNote);
        await wf(A, ON_ENTRY, 5000);
        const NOFF = idFromPath(await A.evaluate("location.pathname"));
        made.push(NOFF);
        await sleep(500);
        await toTimeline(A);
        await wf(A, `${rowOf(NOFF)}?.textContent.includes(${JSON.stringify(offNote)})`, 10_000);
        await check("offline: the new note's row shows its unsynced text", true);
        await sleep(1500);
        await check(
          "offline: not on the server yet",
          psql(`SELECT count(*) FROM timeline_entry WHERE id = '${NOFF}'`) === "0",
        );
        t0 = Date.now();
        dA.offline(false);
        await wf(B, editorHas(offWord), 30_000);
        await check("reconnected: the edit arrives on another device", true, `${Date.now() - t0} ms`);
        await visit(B, TIMELINE);
        await wf(B, `${rowOf(NOFF)}?.textContent.includes(${JSON.stringify(offNote)})`, 30_000);
        await check("reconnected: the new note reaches another device", true, `${Date.now() - t0} ms`);
        const offStored = await waitForSql(
          `SELECT count(*) FROM timeline_entry e JOIN note_document d ON d.id = e.id WHERE e.id = '${NOFF}' AND e.body IS NULL AND e.deleted_at IS NULL`,
        );
        const offText = await waitForSql(
          `SELECT (SELECT count(*) FROM note_update WHERE document_id = '${NOFF}') + (SELECT count(*) FROM note_document WHERE id = '${NOFF}' AND text LIKE '%${offNote}%')`,
        );
        await check(
          "reconnected: uploaded without rejection (entry, document and text)",
          offStored === "1" && offText !== "0",
          `${offStored}/${offText}`,
        );

        // -----------------------------------------------------------------------
        section("A time change and a delete reach the others");
        await start(A, "Note");
        await A.keyboard.insertText(`${tag} written later`);
        await wf(A, ON_ENTRY, 5000);
        const N4 = idFromPath(await A.evaluate("location.pathname"));
        made.push(N4);
        const occurredMs = () =>
          Number(
            psql(
              `SELECT (extract(epoch FROM occurred_at) * 1000)::bigint FROM timeline_entry WHERE id = '${N4}'`,
            ) || 0,
          );
        await waitForSql(`SELECT count(*) FROM timeline_entry WHERE id = '${N4}'`, (r) => r === "1");
        // Notes only: a note a day back stays on the first page however many recent or upcoming entries there are.
        await visit(B, `${TIMELINE}?kind=note`);
        await wf(B, dayOfRow(N4), 15_000);
        const dayBefore = await B.evaluate(dayOfRow(N4));
        await visit(C, entryPath(N4));
        await wf(C, editorHas(`${tag} written later`), 15_000);
        const before = await headerTimeMs(A);
        await shiftDay(A, -1);
        const movedMs = before - DAY_MS;
        await waitForSql(
          `SELECT (extract(epoch FROM occurred_at) * 1000)::bigint FROM timeline_entry WHERE id = '${N4}'`,
          (r) => Math.abs(Number(r) - movedMs) < 1000,
        );
        await check("time: the change reaches Postgres", Math.abs(occurredMs() - movedMs) < 1000);
        await wf(B, `${dayOfRow(N4)} === "Yesterday"`, 15_000);
        await check("time: another member's timeline moves the row", true, `${dayBefore} → Yesterday`);
        await wf(C, `Math.abs(new Date(${HEADER_TIME}.dateTime) - ${movedMs}) < 1000`, 15_000);
        await check("time: a viewer on the page sees the new time", true);
        await visit(B, entryPath(N4));
        await wf(B, editorHas(`${tag} written later`), 15_000);
        await press(A, MENU);
        await wf(A, menuItem("Delete"), 5000);
        await press(A, menuItem("Delete"));
        await wf(A, `document.querySelector("dialog[open]")`, 5000);
        await press(A, dialogButton("Delete"));
        await wf(A, `location.pathname === ${JSON.stringify(TIMELINE)}`, 10_000);
        await check(
          "delete: soft-deleted in Postgres",
          (await waitForSql(
            `SELECT (deleted_at IS NOT NULL)::text FROM timeline_entry WHERE id = '${N4}'`,
            (r) => r === "true",
          )) === "true",
        );
        await wf(B, bodyHas("This entry was deleted."), 15_000);
        await wf(C, bodyHas("This entry was deleted."), 15_000);
        await check("delete: others on the page (writer and viewer) see the deleted state", true);

        // -----------------------------------------------------------------------
        section("A shared link, signed out");
        await D.goto(BASE + entryPath(N1));
        await wf(D, `location.pathname === "/sign-in" && location.search.includes("redirectTo")`, 15_000);
        await check(
          "signed out: the link asks to sign in, and shows nothing of the note",
          !(await D.evaluate(bodyHas(tag))),
        );
        await D.locator('input[name="email"]').fill("caretaker@example.com");
        await D.locator('input[name="password"]').fill(PASSWORD);
        await D.locator('form button[type="submit"]').click();
        await wf(
          D,
          `location.pathname === ${JSON.stringify(entryPath(N1))} && ${editorHas(`${tag} first words`)}`,
          20_000,
        );
        await check("signed out: after signing in, the link lands on the entry", true);

        // -----------------------------------------------------------------------
        section("Appointment details offline, then reconnect");
        const CHIP_DIALOG = `document.querySelector('[role=dialog][aria-label="When it happened"]')`;
        const PLACE = `document.querySelector('main [data-region="place"] input')`;
        const PLACE_REGION = `document.querySelector('main [data-region="place"]')`;
        const HEADER_TEXT = `${HEADER_TIME}?.textContent ?? ""`;
        await visit(C, entryPath(E1));
        await wf(C, `${HEADER_TIME} && ${EDITOR}`, 15_000);
        await toTimeline(A);
        await press(A, `${rowOf(E1)}.querySelector('a[aria-label^="Open "]')`);
        await wf(A, `location.pathname === ${JSON.stringify(entryPath(E1))} && ${PLACE}`, 15_000);
        dA.offline(true);
        await waits(A, `document.body.textContent.includes("Offline")`, 20_000);
        const offPlace = `${tag} offline place`;
        await A.evaluate(`${PLACE}.focus()`);
        await A.locator('main [data-region="place"] input').fill(offPlace);
        await A.keyboard.press("Enter");
        await press(A, TIME_CHIP);
        await wf(A, `${CHIP_DIALOG}?.querySelector('input[type=checkbox]')`, 5000);
        await tap(A, `${CHIP_DIALOG}.querySelector('input[type=checkbox]')`);
        await press(A, button("Done"));
        await wf(A, `!${CHIP_DIALOG}`, 5000);
        await sleep(1500);
        await check(
          "offline: the place and all day show locally, not on the server yet",
          (await A.evaluate(
            `${PLACE}.value === ${JSON.stringify(offPlace)} && /All day/.test(${HEADER_TEXT})`,
          )) &&
            psql(`SELECT (place IS NULL AND NOT all_day)::text FROM timeline_entry WHERE id = '${E1}'`) ===
              "true",
        );
        dA.offline(false);
        const reached = await waitForSql(
          `SELECT (place = '${offPlace}' AND all_day)::text FROM timeline_entry WHERE id = '${E1}'`,
          (r) => r === "true",
          30_000,
        );
        await check("reconnected: they reach the server", reached === "true", reached);
        await wf(
          C,
          `${PLACE_REGION}?.textContent.includes(${JSON.stringify(offPlace)}) && /All day/.test(${HEADER_TEXT})`,
          15_000,
        );
        await check("reconnected: another device gets them", true);
      }

      const errors = [dA, dB, dC, dD]
        .filter(Boolean)
        .flatMap((d) => d.errors)
        .filter((e) => !NOISE.test(e));
      await check("no console errors or warnings", errors.length === 0, errors.slice(0, 5).join(" | "));
    } finally {
      // Tidy up: the next run (and phase2) starts from the seeds' timeline.
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
  },
);
