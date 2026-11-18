// Live notes slice 1: a note is its document. Four browsers in Dev Family:
// member@ (owner, through a switchable proxy for the offline checks),
// caretaker@, viewer@, and a fourth that starts signed out (then viewer@,
// then admin@, who isn't a member).
import { execSync } from "node:child_process";
import { launch, openPage, sleep } from "./cdp.mjs";
import { startProxy } from "./proxy.mjs";

// The dev Postgres container: a loop's own (PG_CONTAINER in .env.loop) or the main one.
const PG_CONTAINER = process.env.PG_CONTAINER ?? "caretook-postgres-1";

const PW = process.env.SEED_USER_PASSWORD ?? "caretook-dev-password";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const psql = (sql) =>
  execSync(`docker exec ${PG_CONTAINER} psql -U caretook -d caretook -tAc ${JSON.stringify(sql)}`)
    .toString()
    .trim();
/** Poll Postgres until `sql` returns something truthy (not "", "0" or "f"). */
const waitForSql = async (sql, ms = 15000) => {
  const end = Date.now() + ms;
  let last = "";
  while (Date.now() < end) {
    last = psql(sql);
    if (last && last !== "0" && last !== "f") return last;
    await sleep(300);
  }
  return last;
};

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const ON_ENTRY = `/\\/entries\\/${UUID}$/.test(location.pathname)`;
const rowWith = (text) =>
  `[...document.querySelectorAll("ol > li")].find((li) => li.textContent.includes(${JSON.stringify(text)}))`;
const tile = (text) =>
  `[...document.querySelectorAll('[aria-label="Add to the timeline"] a, [aria-label="Add to the timeline"] button')].find((b) => b.textContent.trim() === ${JSON.stringify(text)})`;
const linkText = (text) =>
  `[...document.querySelectorAll("a")].find((a) => a.textContent.trim() === ${JSON.stringify(text)})`;
const EDITOR = `document.querySelector(".ProseMirror")`;
const editorHas = (text) => `${EDITOR}?.textContent.includes(${JSON.stringify(text)})`;
const EDITOR_FOCUSED = `document.activeElement?.classList.contains("ProseMirror")`;
const localCount = (table) =>
  `window.caretookSync.powersync.getAll("SELECT count(*) AS n FROM ${table}").then((r) => r[0].n)`;

/** Type into the editor as a person would: focus the end, then insert text. */
async function typeInEditor(p, text) {
  await p.evaluate(`(() => { const el = ${EDITOR}; el.focus();
    const sel = getSelection(); sel.selectAllChildren(el); sel.collapseToEnd(); return true; })()`);
  await p.send("Input.insertText", { text });
}
async function newParagraph(p) {
  const key = { key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 };
  await p.send("Input.dispatchKeyEvent", { type: "keyDown", ...key, text: "\r" });
  await p.send("Input.dispatchKeyEvent", { type: "keyUp", ...key });
}

const proxyA = startProxy(9431);
const bA = await launch(9441, proxyA.args);
const bB = await launch(9442);
const bC = await launch(9443);
const bD = await launch(9444);
const pages = [];
try {
  const A = await openPage(bA, "member");
  const B = await openPage(bB, "caretaker");
  const C = await openPage(bC, "viewer");
  const D = await openPage(bD, "fresh");
  pages.push(A, B, C, D);
  await A.signIn("member@example.com", PW);
  await B.signIn("caretaker@example.com", PW);
  await C.signIn("viewer@example.com", PW);
  for (const p of [A, B, C]) await p.waitFor(`document.querySelectorAll("ol > li").length > 0`, 20000);
  const timelineUrl = await A.evaluate("location.pathname");
  const groupId = timelineUrl.split("/")[3];
  const tag = `LN1-${Date.now()}`;

  // 1. An abandoned draft writes nothing, locally or in Postgres.
  const before = {
    entries: await A.evaluate(localCount("timeline_entry")),
    docs: await A.evaluate(localCount("note_document")),
    pgEntries: psql("SELECT count(*) FROM timeline_entry"),
    pgDocs: psql("SELECT count(*) FROM note_document"),
  };
  await A.press(tile("Note"));
  await A.waitFor(`location.pathname.endsWith("/entries/new") && ${EDITOR_FOCUSED}`, 10000);
  await sleep(1500);
  await A.press(linkText("Timeline"));
  await A.waitFor(`location.pathname === ${JSON.stringify(timelineUrl)}`);
  await sleep(1500);
  const after = {
    entries: await A.evaluate(localCount("timeline_entry")),
    docs: await A.evaluate(localCount("note_document")),
    pgEntries: psql("SELECT count(*) FROM timeline_entry"),
    pgDocs: psql("SELECT count(*) FROM note_document"),
  };
  check(
    "draft: leaving without typing writes nothing (local and Postgres)",
    JSON.stringify(before) === JSON.stringify(after),
    JSON.stringify(after),
  );

  // 2. One tap from the timeline, then typing: the cursor is already in the document.
  const historyBefore = await A.evaluate("history.length");
  await A.press(tile("Note"));
  await A.waitFor(`${EDITOR_FOCUSED}`, 10000);
  check("start: one tap opens the editor with the cursor in it", true);
  check(
    "start: the time defaults to now",
    await A.evaluate(
      `Math.abs(new Date(document.querySelector("header time").dateTime) - Date.now()) < 60000`,
    ),
  );
  await A.send("Input.insertText", { text: `${tag} first words` });
  await A.waitFor(ON_ENTRY, 5000);
  const entryPath = await A.evaluate("location.pathname");
  const entryId = entryPath.split("/").at(-1);
  check("save: the first keystroke replaces the URL with the entry's", true, entryPath);
  check(
    "save: replaced, not pushed",
    (await A.evaluate("history.length")) === historyBefore + 1,
    `history ${historyBefore} → ${await A.evaluate("history.length")}`,
  );
  check(
    "save: the editor kept the text and focus",
    await A.evaluate(`${editorHas(`${tag} first words`)} && ${EDITOR_FOCUSED}`),
  );

  // 3. In Postgres: the entry (no body), its document and updates, as the member.
  const stored = await waitForSql(
    `SELECT e.kind || '|' || coalesce(e.body, 'NULL') || '|' || u.email FROM timeline_entry e JOIN "user" u ON u.id = e.created_by JOIN note_document d ON d.id = e.id WHERE e.id = '${entryId}'`,
  );
  check(
    "server: a note with a null body and its document",
    stored === "note|NULL|member@example.com",
    stored,
  );
  const authors = await waitForSql(
    `SELECT coalesce((SELECT string_agg(DISTINCT u.email, ',') FROM note_update n JOIN "user" u ON u.id = n.created_by WHERE n.document_id = '${entryId}'), (SELECT CASE WHEN snapshot IS NOT NULL THEN 'compacted' END FROM note_document WHERE id = '${entryId}'), '')`,
  );
  check(
    "server: edits stored as the member",
    authors === "member@example.com" || authors === "compacted",
    authors,
  );

  // 4. Others open it; edits converge; the viewer watches, read-only.
  await B.goto(entryPath);
  await B.waitFor(editorHas(`${tag} first words`), 15000);
  await C.goto(entryPath);
  await C.waitFor(editorHas(`${tag} first words`), 15000);
  check(
    "viewer: read-only, no toolbar, no title field",
    await C.evaluate(
      `${EDITOR}.getAttribute("contenteditable") === "false" && !document.querySelector("[role=toolbar]") && !document.querySelector("main header input")`,
    ),
  );
  await newParagraph(A);
  await typeInEditor(A, `${tag} from A`);
  await typeInEditor(B, ` ${tag} from B`);
  for (const p of [A, B, C]) {
    await p.waitFor(`${editorHas(`${tag} from A`)} && ${editorHas(`${tag} from B`)}`, 15000);
  }
  await sleep(1500);
  const texts = await Promise.all([A, B, C].map((p) => p.evaluate(`${EDITOR}.textContent`)));
  check(
    "merge: two writers converge, and the viewer sees it",
    texts.every((t) => t === texts[0]),
    texts[0].slice(0, 80),
  );

  // 5. The title is optional, saved on blur, and syncs.
  await A.evaluate(`document.querySelector("main header input").focus()`);
  await A.type(`document.querySelector("main header input")`, `${tag} Morning`);
  await A.evaluate(`document.querySelector("main header input").blur()`);
  await C.waitFor(`document.querySelector("main header")?.textContent.includes("${tag} Morning")`, 15000);
  check("title: a writer's rename reaches the viewer", true);
  await A.screenshot("ln1-writer");
  await C.screenshot("ln1-viewer");

  // 6. Back returns to the timeline (the draft's `new` URL is gone).
  await A.evaluate("history.back()");
  await A.waitFor(`location.pathname === ${JSON.stringify(timelineUrl)}`, 10000);
  check("back: returns to the timeline", true);

  // 7. The row shows the document's text, with no separate live notes block.
  await C.goto(timelineUrl);
  await C.waitFor(`${rowWith(`${tag} Morning`)}?.textContent.includes("${tag} first words")`, 15000);
  check(
    "timeline: the note's row shows its document as the body",
    await C.evaluate(`!/live notes/i.test(${rowWith(`${tag} Morning`)}.textContent)`),
  );

  // 8. Offline: edits show in the preview before syncing, and a new note uploads after reconnecting.
  proxyA.setOnline(false);
  await A.waitFor(`document.body.textContent.includes("Offline")`, 20000).catch(() => undefined);
  // In-app navigation only from here: a full page load needs the network.
  await A.press(tile("Note"));
  await A.waitFor(EDITOR_FOCUSED, 10000);
  const offWord = `${tag}-offline`;
  await A.send("Input.insertText", { text: offWord });
  await A.waitFor(ON_ENTRY, 5000);
  const offId = (await A.evaluate("location.pathname")).split("/").at(-1);
  await sleep(500);
  await A.press(linkText("Timeline"));
  await A.waitFor(rowWith(offWord), 10000);
  check("offline: the new note's row shows its unsynced text", true);
  await sleep(1500);
  check(
    "offline: not on the server yet",
    psql(`SELECT count(*) FROM timeline_entry WHERE id = '${offId}'`) === "0",
  );
  const t0 = Date.now();
  proxyA.setOnline(true);
  await B.goto(timelineUrl);
  await B.waitFor(rowWith(offWord), 30000);
  check("offline: arrives on another device after reconnecting", true, `${Date.now() - t0} ms`);
  const offStored = await waitForSql(
    `SELECT count(*) FROM timeline_entry e JOIN note_document d ON d.id = e.id WHERE e.id = '${offId}' AND e.body IS NULL AND e.deleted_at IS NULL`,
  );
  const offText = await waitForSql(
    `SELECT (SELECT count(*) FROM note_update WHERE document_id = '${offId}') + (SELECT count(*) FROM note_document WHERE id = '${offId}' AND text LIKE '%${offWord}%')`,
  );
  check(
    "offline: uploaded without rejection (entry, document and text)",
    offStored === "1" && offText !== "0",
    `${offStored}/${offText}`,
  );
  await A.waitFor(rowWith(offWord), 5000);
  check("offline: still on the device that wrote it (not rolled back)", true);

  // 9. The entry sheet offers only Symptom and Vitals (notes and events have their own page).
  await B.press(tile("Symptom"));
  await B.waitFor(`document.querySelector("[role=dialog] form")`);
  check(
    "sheet: only Symptom and Vitals",
    await B.evaluate(
      `(() => { const kinds = [...document.querySelectorAll('[role=dialog] fieldset .join > *')].map((el) => el.getAttribute("aria-label") ?? el.textContent.trim());
        return JSON.stringify(kinds) === JSON.stringify(["Symptom", "Vitals ▾"]); })()`,
    ),
  );

  // 10. 404s and the sign-in round trip.
  const symptomId = psql(
    `SELECT id FROM timeline_entry WHERE kind = 'symptom' AND deleted_at IS NULL LIMIT 1`,
  );
  await B.goto(`/app/groups/${groupId}/entries/${symptomId}`);
  await B.waitFor(`document.body.textContent.includes("Not found")`, 10000);
  check("404: a symptom id isn't an entry page", true);
  await D.goto(entryPath);
  await D.waitFor(`location.pathname === "/sign-in" && location.search.includes("redirectTo")`, 15000);
  await D.type(`document.querySelector('input[name="email"]')`, "viewer@example.com");
  await D.type(`document.querySelector('input[name="password"]')`, PW);
  await D.press(`document.querySelector('form button[type="submit"]')`);
  await D.waitFor(
    `location.pathname === ${JSON.stringify(entryPath)} && ${editorHas(`${tag} first words`)}`,
    20000,
  );
  check("signed out: sign in, then back to the entry", true);
  await D.signOut();
  await D.waitFor(`location.pathname === "/sign-in" || location.pathname === "/"`, 15000);
  await D.signIn("admin@example.com", PW);
  await D.goto(entryPath);
  await D.waitFor(`document.body.textContent.includes("Not found")`, 15000);
  check(
    "404: a non-member sees Not found, and nothing of the note",
    !(await D.evaluate(`document.body.textContent.includes(${JSON.stringify(tag)})`)),
  );

  const noise =
    /401|Failed to load resource|\[vite\] failed to connect|Failed to send error to Vite|\[PowerSync\]: Sync error|\[PowerSync\]: Initial connect attempt|error closing database connection|Error: Not found|status: 404|ErrorResponse/;
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
  for (const b of [bA, bB, bC, bD]) b.proc.kill();
  proxyA.close?.();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
