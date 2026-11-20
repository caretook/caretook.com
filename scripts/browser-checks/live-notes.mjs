// Live notes end to end: what needs real devices, the server and PowerSync.
// Notes and events are their live document (the live notes UX PRD). member@
// starts a note and an event in one tap each, and they upload as the member
// (a null body, the document, "Event" for an unnamed event); a rename reaches
// the viewer; Live now from another device (the banner and dot on two other
// devices, Join in one tap); who's typing across three devices (avatars,
// live typing, concurrent edits converging, compaction, a heading); offline
// then reconnect (an edit, a new note, an appointment's place and all day);
// a time change and a delete reaching the others; and a shared link opened
// signed out.
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
// out (then signs in as caretaker@). SMOKE=1 runs member@'s core path only: a
// note in 1 tap, saved on the first keystroke, and an event in 1 tap, saved as
// "Event" (one browser, online).
import { execSync } from "node:child_process";
import { BASE, launch, openPage, sleep, step, SMOKE } from "./cdp.mjs";
import { startProxy } from "./proxy.mjs";

const PG_CONTAINER = process.env.PG_CONTAINER ?? "caretook-postgres-1";
const PW = process.env.SEED_USER_PASSWORD ?? "caretook-dev-password";
const started = Date.now();

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const section = (title) => console.log(`\n# ${title}  [${Math.round((Date.now() - started) / 1000)} s]`);

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
  // A check build has no Vite client, so nothing to reload the page.
  if (!(await p.evaluate(`!!document.querySelector('script[src*="/@vite/client"]')`))) return;
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
// Smoke runs member@ alone.
const bB = SMOKE ? null : await launch(9412);
const bC = SMOKE ? null : await launch(9413);
const bD = SMOKE ? null : await launch(9414);
const pages = [];
try {
  const A = await openPage(bA, "member");
  const B = bB && (await openPage(bB, "caretaker"));
  const C = bC && (await openPage(bC, "viewer"));
  const D = bD && (await openPage(bD, "fresh"));
  pages.push(...[A, B, C, D].filter(Boolean));

  section("Sign in, and warm the routes");
  const members = [A, B, C].filter(Boolean);
  // caretaker@ (not proxied) visits the timeline and the editor first, so a
  // Vite re-optimise reload on a fresh dev server happens here, not mid-step
  // (settle() returns at once on a check build).
  if (B) {
    await signInWarm(B, "caretaker@example.com");
    await visit(B, TIMELINE);
    await settle(B, `${ROWS} > 0`);
    await visit(B, `/app/groups/${GROUP}/entries/new?kind=note`);
    await settle(B, EDITOR);
  }
  await signInWarm(A, "member@example.com");
  if (C) await signInWarm(C, "viewer@example.com");
  for (const p of members) {
    await visit(p, TIMELINE);
    await settle(p, `${ROWS} > 0`);
  }
  // Right after a reset, PowerSync's first connect can fail on a 401 while it
  // refetches the regenerated JWKS, and retries a few seconds later: wait
  // until every device is connected, so the timed steps don't measure that.
  await Promise.all(
    members.map((p) => p.waitFor(`window.caretookSync?.powersync.currentStatus.connected`, 30000)),
  );
  // The one reload the warm-up is for, if it happened, isn't an error.
  const warmNoise = /Error loading route module|Failed to fetch dynamically imported module/;
  for (const p of members) p.errors.splice(0, p.errors.length, ...p.errors.filter((e) => !warmNoise.test(e)));
  check(`setup: ${members.length === 3 ? "three members see" : "member@ sees"} the timeline`, true);

  // -------------------------------------------------------------------------
  section("Note: one tap, saved on the first keystroke, uploaded as the member");
  taps = 0;
  await start(A, "Note");
  check("note: typing after 1 tap (Note), with the cursor in the document", taps === 1, `${taps} tap`);
  await A.send("Input.insertText", { text: `${tag} first words` });
  await A.waitFor(ON_ENTRY, 5000);
  const N1 = idFromPath(await A.evaluate("location.pathname"));
  made.push(N1);
  check("note: the first keystroke replaces the URL with the entry's", true, entryPath(N1));
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
  await step("note: the viewer's row", async () => {
    // The text and the title sync as separate writes (the document, then the
    // entry's rename), so wait for both, not for the text alone.
    const both = `(${rowOf(N1)}?.textContent ?? "")`;
    const has = (t) => `${both}.includes(${JSON.stringify(t)})`;
    const seen = await C.waitFor(`${has(`${tag} first words`)} && ${has(N1_TITLE)}`, 20000)
      .then(() => true)
      .catch(() => false);
    check(
      "note: the viewer's row shows the document as its body, and the title",
      seen,
      await C.evaluate(`${both}.slice(0, 160)`),
    );
  });

  // -------------------------------------------------------------------------
  section('Event: one tap; an unnamed event is saved as "Event"');
  taps = 0;
  await start(A, "Event");
  check("event: typing after 1 tap (Event)", taps === 1, `${taps} tap`);
  await A.send("Input.insertText", { text: `${tag} event start` });
  await A.waitFor(ON_ENTRY, 10000);
  const E1 = idFromPath(await A.evaluate("location.pathname"));
  made.push(E1);
  await A.waitFor(`${TITLE}?.placeholder === "Add a title" && ${TITLE}.value === ""`, 10000);
  const e1Saved = await waitForSql(
    `SELECT title || '|' || coalesce(body, 'null') FROM timeline_entry WHERE id = '${E1}'`,
    (r) => r === "Event|null",
  );
  check(
    'event: in Postgres as "Event", with no body, and an "Add a title" prompt',
    e1Saved === "Event|null",
    e1Saved,
  );

  // Smoke stops here: the rest needs the other members' devices.
  await step(
    "renames, Live now, who's typing, offline, time, delete, the link and appointments",
    async () => {
      // -------------------------------------------------------------------------
      section("A rename reaches the viewer");
      await C.waitFor(`${rowOf(E1)}?.textContent.includes(${JSON.stringify(`${tag} event start`)})`, 20000);
      await C.press(`${rowOf(E1)}.querySelector('a[aria-label^="Open "]')`);
      await C.waitFor(editorHas(`${tag} event start`), 15000);
      const E1_TITLE = `${tag} Dr. Lee visit`;
      await setTitle(A, E1_TITLE);
      await blurTitle(A);
      await C.waitFor(`${HEADER}?.textContent.includes(${JSON.stringify(E1_TITLE)})`, 15000);
      const e1Stored = await waitForSql(
        `SELECT title || '|' || coalesce(body, 'null') FROM timeline_entry WHERE id = '${E1}'`,
        (r) => r.startsWith(E1_TITLE),
      );
      check(
        "event: a typed rename reaches the viewer and Postgres",
        e1Stored === `${E1_TITLE}|null`,
        e1Stored,
      );

      // -------------------------------------------------------------------------
      section("Live now from another device: the banner, the dot and Join");
      await quiet([N1, E1], [B, C]);
      for (const p of [B, C]) {
        await visit(p, TIMELINE);
        await p.waitFor(`${rowOf(N1)} && ${rowOf(E1)}`, 20000);
      }
      const ours = JSON.stringify([N1, E1]);
      check(
        "idle: no live dot on the check's entries, and the banner isn't for them",
        await B.evaluate(`!${dotOf(N1)} && !${dotOf(E1)} && !${ours}.includes(${BANNER_ID})`),
      );
      await openFromTimeline(A, N1);
      let t0 = Date.now();
      await typeInEditor(A, ` ${tag}-live1`);
      await Promise.all(
        [B, C].map((p) => p.waitFor(`${BANNER_ID} === ${JSON.stringify(N1)} && ${dotOf(N1)}`, 15000)),
      );
      let latency = Date.now() - t0;
      // ~0.5–2 s on a quiet machine; the bound allows for a shared one (B-110).
      check(
        "appear: banner and dot on two other devices within a few seconds",
        latency <= 6000,
        `${latency} ms`,
      );
      const bannerText = await B.evaluate(`${BANNER}.innerText.replace(/\\s+/g, " ").trim()`);
      check(
        "banner: '<name> is writing · <title> · Join'",
        bannerText.startsWith(`${MEMBER_NAME} is writing · ${N1_TITLE}`) && bannerText.endsWith("Join"),
        bannerText,
      );
      taps = 0;
      await tap(C, `${BANNER}.querySelector("a")`);
      const joined = await C.waitFor(
        `location.pathname === ${JSON.stringify(entryPath(N1))} && ${EDITOR}`,
        15000,
      )
        .then(() => true)
        .catch(() => false);
      check("join: 1 tap (Join) opens the entry", joined && taps === 1, `${taps} tap`);

      // -------------------------------------------------------------------------
      section("Who's typing, convergence and authorship");
      await visit(B, entryPath(N1));
      await B.waitFor(EDITOR, 15000);
      t0 = Date.now();
      await typeInEditor(A, ` ${tag}-e1`);
      await Promise.all([B.waitFor(hasAvatar(MEMBER), 15000), C.waitFor(hasAvatar(MEMBER), 15000)]);
      latency = Date.now() - t0;
      check("avatars: the others see the writer within a few seconds", latency <= 6000, `${latency} ms`);
      check(
        "avatars: initials",
        (await B.evaluate(`${AVATARS}[0]?.textContent`)) === initials(MEMBER_NAME),
        await B.evaluate(`${AVATARS}[0]?.textContent`),
      );
      check("avatars: the writer doesn't see themselves", (await A.evaluate(`${AVATARS}.length`)) === 0);
      // The member's edits upload first (their device is behind a proxy, B-110), so the caretaker's are the most recent.
      await A.waitFor(`${localRows("SELECT count(*) AS n FROM ps_crud")}.then((r) => r[0].n === 0)`, 15000);
      await typeInEditor(B, ` ${tag}-b`);
      await A.waitFor(hasAvatar(CARETAKER), 15000);
      await C.waitFor(hasAvatar(CARETAKER), 15000);
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
      const snapshotBefore = psql(`SELECT md5(coalesce(snapshot, '')) FROM note_document WHERE id = '${N1}'`);
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
      check(
        "server: compacted, with both writers (and not the viewer) as editors",
        compacted === "t",
        compacted,
      );
      await B.waitFor(
        `${localRows("SELECT count(*) AS n FROM note_update WHERE document_id = ?", [N1])}.then((r) => r[0].n === 0)`,
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

      // -------------------------------------------------------------------------
      section("Offline, then reconnect: an edit and a new note");
      // Offline, only in-app navigation works, and only to route modules this page
      // has already loaded: through the timeline.
      await toTimeline(A);
      await A.press(`${rowOf(N1)}.querySelector('a[aria-label^="Open "]')`);
      await A.waitFor(
        `location.pathname === ${JSON.stringify(entryPath(N1))} && ${editorHas(`${tag} Questions`)}`,
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
      check("reconnected: the edit arrives on another device", true, `${Date.now() - t0} ms`);
      await visit(B, TIMELINE);
      await B.waitFor(`${rowOf(NOFF)}?.textContent.includes(${JSON.stringify(offNote)})`, 30000);
      check("reconnected: the new note reaches another device", true, `${Date.now() - t0} ms`);
      const offStored = await waitForSql(
        `SELECT count(*) FROM timeline_entry e JOIN note_document d ON d.id = e.id WHERE e.id = '${NOFF}' AND e.body IS NULL AND e.deleted_at IS NULL`,
      );
      const offText = await waitForSql(
        `SELECT (SELECT count(*) FROM note_update WHERE document_id = '${NOFF}') + (SELECT count(*) FROM note_document WHERE id = '${NOFF}' AND text LIKE '%${offNote}%')`,
      );
      check(
        "reconnected: uploaded without rejection (entry, document and text)",
        offStored === "1" && offText !== "0",
        `${offStored}/${offText}`,
      );

      // -------------------------------------------------------------------------
      section("A time change and a delete reach the others");
      await start(A, "Note");
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
      // Notes only: a note a day back stays on the first page however many recent or upcoming entries there are.
      await visit(B, `${TIMELINE}?kind=note`);
      await B.waitFor(dayOfRow(N4), 15000);
      const dayBefore = await B.evaluate(dayOfRow(N4));
      await visit(C, entryPath(N4));
      await C.waitFor(editorHas(`${tag} written later`), 15000);
      const before = await headerTimeMs(A);
      await shiftDay(A, -1);
      const movedMs = before - DAY_MS;
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
      await A.press(dialogButton("Delete"));
      await A.waitFor(`location.pathname === ${JSON.stringify(TIMELINE)}`, 10000);
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
      section("A shared link, signed out");
      const link = BASE + entryPath(N1);
      await D.send("Page.navigate", { url: link });
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

      // -------------------------------------------------------------------------
      section("Appointment details offline, then reconnect");
      const CHIP_DIALOG = `document.querySelector('[role=dialog][aria-label="When it happened"]')`;
      const PLACE = `document.querySelector('main [data-region="place"] input')`;
      const PLACE_REGION = `document.querySelector('main [data-region="place"]')`;
      const HEADER_TEXT = `${HEADER_TIME}?.textContent ?? ""`;
      await visit(C, entryPath(E1));
      await C.waitFor(`${HEADER_TIME} && ${EDITOR}`, 15000);
      await toTimeline(A);
      await A.press(`${rowOf(E1)}.querySelector('a[aria-label^="Open "]')`);
      await A.waitFor(`location.pathname === ${JSON.stringify(entryPath(E1))} && ${PLACE}`, 15000);
      proxyA.setOnline(false);
      await A.waitFor(`document.body.textContent.includes("Offline")`, 20000).catch(() => undefined);
      const offPlace = `${tag} offline place`;
      await A.evaluate(`${PLACE}.focus()`);
      await A.type(PLACE, offPlace);
      await pressKey(A, "Enter", "Enter", 13, "\r");
      await A.press(TIME_CHIP);
      await A.waitFor(`${CHIP_DIALOG}?.querySelector('input[type=checkbox]')`, 5000);
      await A.tap(`${CHIP_DIALOG}.querySelector('input[type=checkbox]')`);
      await A.press(button("Done"));
      await A.waitFor(`!${CHIP_DIALOG}`, 5000);
      await sleep(1500);
      check(
        "offline: the place and all day show locally, not on the server yet",
        (await A.evaluate(
          `${PLACE}.value === ${JSON.stringify(offPlace)} && /All day/.test(${HEADER_TEXT})`,
        )) &&
          psql(`SELECT (place IS NULL AND NOT all_day)::text FROM timeline_entry WHERE id = '${E1}'`) ===
            "true",
      );
      proxyA.setOnline(true);
      const reached = await waitForSql(
        `SELECT (place = '${offPlace}' AND all_day)::text FROM timeline_entry WHERE id = '${E1}'`,
        (r) => r === "true",
        30000,
      );
      check("reconnected: they reach the server", reached === "true", reached);
      await C.waitFor(
        `${PLACE_REGION}?.textContent.includes(${JSON.stringify(offPlace)}) && /All day/.test(${HEADER_TEXT})`,
        15000,
      );
      check("reconnected: another device gets them", true);
    },
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
  for (const b of [bA, bB, bC, bD]) b?.proc.kill();
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
