// Live notes slice 6: who's typing. Three browsers in Dev Family on one
// seeded note: member@ (owner) types, caretaker@ and viewer@ watch the
// header's editors region. Covers the stream syncing `editors`, the avatar
// appearing within ~2 s, nobody seeing themselves, the signal surviving
// compaction, and expiry: Postgres times are moved back to just inside the
// 2-minute window, and the avatar must go on the device's ~15 s timer with
// no new rows arriving.
import { execSync } from "node:child_process";
import { launch, openPage, sleep } from "./cdp.mjs";

// The dev Postgres container: a loop's own (PG_CONTAINER in .env.loop) or the main one.
const PG_CONTAINER = process.env.PG_CONTAINER ?? "caretook-postgres-1";

const PW = process.env.SEED_USER_PASSWORD ?? "caretook-dev-password";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
// The SQL goes in on stdin, so quotes and newlines need no shell escaping.
const psql = (sql) =>
  execSync(`docker exec -i ${PG_CONTAINER} psql -U caretook -d caretook -tAq -v ON_ERROR_STOP=1`, {
    input: `${sql};`,
  })
    .toString()
    .trim();
const EDITOR = `document.querySelector(".ProseMirror")`;
const AVATARS = `[...document.querySelectorAll('main [data-region="editors"] [data-editor]')]`;
const avatarIds = (p) => p.evaluate(`${AVATARS}.map((el) => el.dataset.editor)`);
const editorsLabel = (p) =>
  p.evaluate(
    `document.querySelector('main [data-region="editors"] [role="group"]')?.getAttribute("aria-label") ?? ""`,
  );
const hasAvatar = (id) => `${AVATARS}.some((el) => el.dataset.editor === ${JSON.stringify(id)})`;

async function typeInEditor(p, text) {
  await p.evaluate(`(() => { const el = ${EDITOR}; el.focus();
    const sel = getSelection(); sel.selectAllChildren(el); sel.collapseToEnd(); return true; })()`);
  await p.send("Input.insertText", { text });
}

const idOf = (email) => psql(`SELECT id FROM "user" WHERE email = '${email}'`);
const MEMBER = idOf("member@example.com");
const CARETAKER = idOf("caretaker@example.com");
const VIEWER = idOf("viewer@example.com");
// A seeded note nobody has touched for at least an hour: its editors are its author, long ago.
const NOTE = psql(
  `SELECT e.id FROM timeline_entry e JOIN note_document d ON d.id = e.id
   WHERE e.kind = 'note' AND e.deleted_at IS NULL AND e.occurred_at < now() - interval '1 hour'
   ORDER BY e.occurred_at DESC LIMIT 1`,
);
const GROUP = psql(`SELECT group_id FROM timeline_entry WHERE id = '${NOTE}'`);
const notePath = `/app/groups/${GROUP}/entries/${NOTE}`;

const bA = await launch(9461);
const bB = await launch(9462);
const bC = await launch(9463);
const pages = [];
try {
  const A = await openPage(bA, "member");
  const B = await openPage(bB, "caretaker");
  const C = await openPage(bC, "viewer");
  pages.push(A, B, C);
  await A.signIn("member@example.com", PW);
  await B.signIn("caretaker@example.com", PW);
  await C.signIn("viewer@example.com", PW);
  for (const p of [A, B, C]) await p.waitFor(`document.querySelectorAll("ol > li").length > 0`, 20000);

  // 1. The stream brings `editors` to the device.
  const localEditors = await B.evaluate(
    `window.caretookSync.powersync.getAll("SELECT editors FROM note_document WHERE id = ?", [${JSON.stringify(NOTE)}]).then((r) => r[0]?.editors ?? null)`,
  );
  const serverEditors = psql(`SELECT editors FROM note_document WHERE id = '${NOTE}'`);
  check(
    "sync: note_document.editors reaches the device",
    !!localEditors && JSON.stringify(JSON.parse(localEditors)) === JSON.stringify(JSON.parse(serverEditors)),
    String(localEditors),
  );

  // 2. Nobody is shown for an old note.
  for (const p of [A, B, C]) {
    await p.goto(notePath);
    await p.waitFor(`${EDITOR}`, 15000);
  }
  await sleep(1000);
  check("idle: no avatars on a note nobody is editing", (await avatarIds(B)).length === 0);

  // 3. A types: B and C see A within ~2 s. A never sees A.
  const tag = `ED6-${Date.now()}`;
  const t0 = Date.now();
  await typeInEditor(A, ` ${tag}`);
  await Promise.all([B.waitFor(hasAvatar(MEMBER), 8000), C.waitFor(hasAvatar(MEMBER), 8000)]);
  const latency = Date.now() - t0;
  check("appear: the others see A's avatar within ~2 s", latency <= 2500, `${latency} ms`);
  check(
    "appear: the avatar shows A's initials and an accessible label",
    (await B.evaluate(`${AVATARS}[0]?.textContent`)) === "DM" && /is editing$/.test(await editorsLabel(B)),
    `${await B.evaluate(`${AVATARS}[0]?.textContent`)} / ${await editorsLabel(B)}`,
  );
  check("self: A doesn't see their own avatar", (await avatarIds(A)).length === 0);

  // 4. B types too: A sees B; B sees only A; the viewer sees both, most recent first.
  await typeInEditor(B, ` ${tag}-b`);
  await A.waitFor(hasAvatar(CARETAKER), 8000);
  await C.waitFor(hasAvatar(CARETAKER), 8000);
  check("self: B sees A but not themselves", JSON.stringify(await avatarIds(B)) === JSON.stringify([MEMBER]));
  check(
    "order: the viewer sees both, most recent first",
    JSON.stringify(await avatarIds(C)) === JSON.stringify([CARETAKER, MEMBER]),
    JSON.stringify(await avatarIds(C)),
  );
  check("self: the viewer never appears", !(await C.evaluate(hasAvatar(VIEWER))));
  await A.screenshot("ed6-member");
  await C.screenshot("ed6-viewer");

  // 5. A keeps typing in bursts until the server compacts (every pending
  //    update folded into the snapshot and deleted): the signal survives it.
  const snapshotBefore = psql(`SELECT md5(coalesce(snapshot, '')) FROM note_document WHERE id = '${NOTE}'`);
  const compactedSql = `SELECT (SELECT count(*) FROM note_update WHERE document_id = '${NOTE}') = 0
       AND md5(coalesce(snapshot, '')) <> '${snapshotBefore}'
       AND editors ? '${MEMBER}' AND editors ? '${CARETAKER}'
     FROM note_document WHERE id = '${NOTE}'`;
  let compacted = "f";
  for (let i = 0; i < 40 && compacted !== "t"; i++) {
    await typeInEditor(A, ` w${i}`);
    await sleep(600);
    compacted = psql(compactedSql);
  }
  check("compaction: updates folded away, both authors in editors", compacted === "t", compacted);
  await B.waitFor(
    `window.caretookSync.powersync.getAll("SELECT count(*) AS n FROM note_update WHERE document_id = ?", [${JSON.stringify(NOTE)}]).then((r) => r[0].n === 0)`,
    15000,
  );
  check("compaction: A's avatar stays after the updates are gone", await B.evaluate(hasAvatar(MEMBER)));

  // 6. Expiry: move everyone's times back to 105 s ago (just inside the window).
  //    The avatars must stay for now, then go on the timer with no new rows.
  psql(
    `UPDATE note_document SET editors = (SELECT jsonb_object_agg(k, to_char((now() - interval '105 seconds') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) FROM jsonb_object_keys(editors) k) WHERE id = '${NOTE}'`,
  );
  psql(`UPDATE note_update SET created_at = now() - interval '105 seconds' WHERE document_id = '${NOTE}'`);
  const movedAt = Date.now();
  await B.waitFor(
    `window.caretookSync.powersync.getAll("SELECT editors FROM note_document WHERE id = ?", [${JSON.stringify(NOTE)}]).then((r) => Object.values(JSON.parse(r[0].editors)).every((t) => Date.now() - Date.parse(t) > 100000))`,
    15000,
  );
  check("expiry: still shown while inside the window", await B.evaluate(hasAvatar(MEMBER)));
  await Promise.all([
    B.waitFor(`${AVATARS}.length === 0`, 45000),
    C.waitFor(`${AVATARS}.length === 0`, 45000),
  ]);
  const gone = Date.now() - movedAt;
  // Due at 15 s after the move; the 15 s tick adds up to 15 s more.
  check(
    "expiry: the avatars go about 2 minutes after the last edit, on the timer",
    gone >= 12000 && gone <= 40000,
    `${gone} ms after the move`,
  );
  check(
    "expiry: the note's text is untouched",
    await B.evaluate(`${EDITOR}.textContent.includes(${JSON.stringify(tag)})`),
  );

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
