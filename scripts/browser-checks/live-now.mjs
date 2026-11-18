// Live notes slice 7: the timeline's live dot and Live now banner. member@
// (owner) types in two seeded notes; caretaker@ and viewer@ watch the
// timeline. Covers the banner and the dot appearing within ~2 s, "+1 more"
// and the most recent first, Join in one tap, the dot letting taps through,
// reduced motion, one announcement per document, nobody seeing their own
// typing, and expiry: Postgres times are moved back to just inside the
// 2-minute window, and both signals must go on the ~15 s timer. Run it
// after a `pnpm datastore:reset` (nothing may be live at the start).
import { execSync } from "node:child_process";
import { launch, openPage, sleep } from "./cdp.mjs";

const PG_CONTAINER = process.env.PG_CONTAINER ?? "caretook-postgres-1";
const PW = process.env.SEED_USER_PASSWORD ?? "caretook-dev-password";
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

const EDITOR = `document.querySelector(".ProseMirror")`;
const BANNER = `document.querySelector('main section[aria-label="Live now"]')`;
const STATUS = `document.querySelector('main p[role="status"]')`;
const rowOf = (id) => `document.querySelector('main ol > li a[href$="/entries/${id}"]')?.closest("li")`;
const dotOf = (id) => `${rowOf(id)}?.querySelector("[data-live-dot]")`;
const dotCount = `document.querySelectorAll("main ol [data-live-dot]").length`;

async function typeInEditor(p, text) {
  await p.evaluate(`(() => { const el = ${EDITOR}; el.focus();
    const sel = getSelection(); sel.selectAllChildren(el); sel.collapseToEnd(); return true; })()`);
  await p.send("Input.insertText", { text });
}
async function tap(p, selector) {
  const rect = await p.evaluate(`(() => { const el = ${selector}; if (!el) return null;
    el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  if (!rect) throw new Error(`nothing to tap: ${selector}`);
  await sleep(100);
  for (const type of ["mousePressed", "mouseReleased"]) {
    await p.send("Input.dispatchMouseEvent", { type, ...rect, button: "left", clickCount: 1 });
  }
}
// Every non-empty text the status region takes, from now on.
const watchAnnouncements = (p) =>
  p.evaluate(`(() => { window.__announced = []; const el = ${STATUS};
    if (el.textContent) window.__announced.push(el.textContent);
    new MutationObserver(() => { if (el.textContent) window.__announced.push(el.textContent); })
      .observe(el, { childList: true, characterData: true, subtree: true }); return true; })()`);
const announcements = (p) => p.evaluate(`window.__announced`);

const user = (email) => psql(`SELECT id || '|' || name FROM "user" WHERE email = '${email}'`).split("|");
const [, MEMBER_NAME] = user("member@example.com");
// Two recent seeded notes nobody has touched for at least an hour, on the first page.
const [NOTE1, NOTE2] = psql(
  `SELECT e.id FROM timeline_entry e JOIN note_document d ON d.id = e.id
   WHERE e.kind = 'note' AND e.deleted_at IS NULL AND e.occurred_at < now() - interval '1 hour'
   ORDER BY e.occurred_at DESC LIMIT 2`,
).split("\n");
const GROUP = psql(`SELECT group_id FROM timeline_entry WHERE id = '${NOTE1}'`);
const timeline = `/app/groups/${GROUP}/timeline`;
const notePath = (id) => `/app/groups/${GROUP}/entries/${id}`;

const bA = await launch(9471);
const bB = await launch(9472);
const bC = await launch(9473);
const pages = [];
try {
  const A = await openPage(bA, "member");
  const B = await openPage(bB, "caretaker");
  const C = await openPage(bC, "viewer");
  pages.push(A, B, C);
  await A.signIn("member@example.com", PW);
  await B.signIn("caretaker@example.com", PW);
  await C.signIn("viewer@example.com", PW);
  for (const p of [B, C]) {
    await p.goto(timeline);
    await p.waitFor(
      `document.querySelectorAll("ol > li").length > 0 && ${rowOf(NOTE1)} && ${rowOf(NOTE2)}`,
      20000,
    );
  }
  await watchAnnouncements(B);

  // 1. Idle: nothing is live.
  check(
    "idle: no banner and no live dots",
    !(await B.evaluate(`!!${BANNER}`)) && (await B.evaluate(dotCount)) === 0,
  );

  // 2. A types in NOTE1: B and C see the banner and the dot within ~2 s.
  await A.goto(notePath(NOTE1));
  await A.waitFor(EDITOR, 15000);
  const tag = `LN7-${Date.now()}`;
  const t0 = Date.now();
  await typeInEditor(A, ` ${tag}`);
  await Promise.all([
    B.waitFor(`${BANNER} && ${dotOf(NOTE1)}`, 8000),
    C.waitFor(`${BANNER} && ${dotOf(NOTE1)}`, 8000),
  ]);
  const latency = Date.now() - t0;
  check("appear: banner and dot within ~2 s", latency <= 2500, `${latency} ms`);
  const bannerText = await B.evaluate(`${BANNER}.innerText.replace(/\\s+/g, " ").trim()`);
  check(
    "banner: '<name> is writing · <title> · Join'",
    bannerText.startsWith(`${MEMBER_NAME} is writing · `) &&
      bannerText.endsWith("Join") &&
      !/more/.test(bannerText),
    bannerText,
  );
  check("banner: points at the note", (await B.evaluate(`${BANNER}.dataset.liveBanner`)) === NOTE1);
  check("viewer: sees the banner too", (await C.evaluate(`${BANNER}.dataset.liveBanner`)) === NOTE1);
  check(
    "dot: sr-only label names the writer",
    (await B.evaluate(`${dotOf(NOTE1)}.textContent`)) === `Being written now by ${MEMBER_NAME}`,
    await B.evaluate(`${dotOf(NOTE1)}.textContent`),
  );
  check("dot: only on the row being written", (await B.evaluate(dotCount)) === 1);
  // The dot is under the row's open target: a tap on it opens the entry.
  check(
    "dot: taps go through to the row's open target",
    await B.evaluate(`(() => { const r = ${dotOf(NOTE1)}.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return hit?.matches('a[aria-label^="Open "]') && hit.closest("li") === ${rowOf(NOTE1)}; })()`),
  );
  const ping = `getComputedStyle(${dotOf(NOTE1)}.firstElementChild)`;
  check("motion: the dot pulses", (await B.evaluate(`${ping}.animationName`)) === "ping");
  await B.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  check("motion: static under prefers-reduced-motion", (await B.evaluate(`${ping}.display`)) === "none");
  await B.send("Emulation.setEmulatedMedia", { features: [] });
  await B.screenshot("ln7-banner");

  // 3. A keeps typing: still one announcement for NOTE1.
  for (let i = 0; i < 3; i++) {
    await typeInEditor(A, ` more${i}`);
    await sleep(700);
  }
  await sleep(1000);
  let said = await announcements(B);
  check(
    "announce: once for the document, however often it's edited",
    said.length === 1 && said[0].startsWith(`${MEMBER_NAME} is writing: `),
    JSON.stringify(said),
  );

  // 4. A self: their own timeline shows nothing.
  await A.goto(timeline);
  await A.waitFor(`${rowOf(NOTE1)}`, 15000);
  await sleep(1500);
  check(
    "self: A sees no banner and no dot for their own typing",
    !(await A.evaluate(`!!${BANNER}`)) && (await A.evaluate(dotCount)) === 0,
  );

  // 5. A types in NOTE2: it leads, with "+1 more", and both rows have dots.
  await A.goto(notePath(NOTE2));
  await A.waitFor(EDITOR, 15000);
  await typeInEditor(A, ` ${tag}-2`);
  await B.waitFor(`${BANNER}?.dataset.liveBanner === ${JSON.stringify(NOTE2)}`, 8000);
  const two = await B.evaluate(`${BANNER}.innerText.replace(/\\s+/g, " ").trim()`);
  check("two: the most recent leads, with '+1 more'", /· \+1 more/.test(two), two);
  check("two: both rows have a dot", (await B.evaluate(`!!${dotOf(NOTE1)} && !!${dotOf(NOTE2)}`)) === true);
  said = await announcements(B);
  check("announce: the second document once", said.length === 2, JSON.stringify(said));

  // Cards show the dot too.
  await tap(B, `document.querySelector('button[aria-label="Cards"]')`);
  await B.waitFor(`document.querySelector('button[aria-label="Cards"][aria-pressed="true"]')`, 5000);
  check("cards: the dot shows on the card", await B.evaluate(`!!${dotOf(NOTE2)}`));
  await tap(B, `document.querySelector('button[aria-label="Rows"]')`);
  await B.waitFor(`document.querySelector('button[aria-label="Rows"][aria-pressed="true"]')`, 5000);

  // 6. Join opens the note in one tap.
  await tap(C, `${BANNER}.querySelector("a")`);
  const joined = await C.waitFor(
    `location.pathname === ${JSON.stringify(notePath(NOTE2))} && ${EDITOR}`,
    15000,
  )
    .then(() => true)
    .catch(() => false);
  check("join: one tap opens the note", joined, await C.evaluate("location.pathname"));
  await C.goto(timeline);
  await C.waitFor(BANNER, 15000);

  // 7. Expiry: move both documents' times back to 105 s ago (just inside the window).
  const docs = `('${NOTE1}', '${NOTE2}')`;
  psql(
    `UPDATE note_document SET editors = (SELECT jsonb_object_agg(k, to_char((now() - interval '105 seconds') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) FROM jsonb_object_keys(editors) k) WHERE id IN ${docs}`,
  );
  psql(`UPDATE note_update SET created_at = now() - interval '105 seconds' WHERE document_id IN ${docs}`);
  const movedAt = Date.now();
  await B.waitFor(
    `window.caretookSync.powersync.getAll("SELECT d.editors, (SELECT max(created_at) FROM note_update u WHERE u.document_id = d.id) AS u FROM note_document d WHERE d.id IN (?, ?)", [${JSON.stringify(NOTE1)}, ${JSON.stringify(NOTE2)}]).then((rows) => rows.every((r) => Object.values(JSON.parse(r.editors)).every((t) => Date.now() - Date.parse(t) > 100000) && (!r.u || Date.now() - Date.parse(r.u) > 100000)))`,
    15000,
  );
  check("expiry: still shown inside the window", await B.evaluate(`!!${BANNER} && ${dotCount} === 2`));
  await Promise.all([
    B.waitFor(`!${BANNER} && ${dotCount} === 0`, 45000),
    C.waitFor(`!${BANNER} && ${dotCount} === 0`, 45000),
  ]);
  const gone = Date.now() - movedAt;
  check(
    "expiry: banner and dots go about 2 minutes after the last edit, on the timer",
    gone >= 12000 && gone <= 40000,
    `${gone} ms after the move`,
  );
  check("expiry: the status region is cleared", (await B.evaluate(`${STATUS}.textContent`)) === "");

  const noise =
    /401|Failed to load resource|\[vite\] failed to connect|Failed to send error to Vite|\[PowerSync\]: Sync error|\[PowerSync\]: Initial connect attempt|error closing database connection/;
  const errors = pages.flatMap((p) => p.errors).filter((e) => !noise.test(e));
  check("no console errors or warnings", errors.length === 0, errors.slice(0, 5).join(" | "));
} catch (e) {
  check("run", false, e.message);
  for (const p of pages) {
    const where = await p
      .evaluate(`location.pathname + " | " + document.body.innerText.slice(0, 300)`)
      .catch(() => "?");
    console.log("  page:", where.replace(/\n+/g, " / "));
    console.log("  errors:", p.errors.slice(0, 12).join(" | "));
  }
} finally {
  for (const b of [bA, bB, bC]) b.proc.kill();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
