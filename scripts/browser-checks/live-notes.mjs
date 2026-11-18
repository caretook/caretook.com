// Phase 4: live notes. Three browsers: member@ (owner, through a switchable
// proxy for the offline check), caretaker@ and viewer@, all in Dev Family.
import { execSync } from "node:child_process";
import { launch, openPage, sleep } from "./cdp.mjs";
import { startProxy } from "./proxy.mjs";

const PW = process.env.SEED_USER_PASSWORD ?? "caretook-dev-password";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const psql = (sql) =>
  execSync(`docker exec caretook-postgres-1 psql -U caretook -d caretook -tAc ${JSON.stringify(sql)}`)
    .toString()
    .trim();

const rowWith = (text) =>
  `[...document.querySelectorAll("ol > li")].find((li) => li.textContent.includes(${JSON.stringify(text)}))`;
const button = (text) =>
  `[...document.querySelectorAll("button")].find((b) => b.textContent.trim() === ${JSON.stringify(text)})`;
const menuItem = (text) =>
  `[...document.querySelectorAll("[role=menuitem]")].find((m) => m.textContent.trim() === ${JSON.stringify(text)})`;
const EDITOR = `document.querySelector(".ProseMirror")`;
const editorHas = (text) => `${EDITOR}?.textContent.includes(${JSON.stringify(text)})`;

/** Type into the editor as a person would: focus the end, then insert text. */
async function typeInEditor(p, text) {
  await p.evaluate(`(() => { const el = ${EDITOR}; el.focus();
    const sel = getSelection(); sel.selectAllChildren(el); sel.collapseToEnd(); return true; })()`);
  await p.send("Input.insertText", { text });
}
async function newParagraph(p) {
  await p.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
    text: "\r",
  });
  await p.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
  });
}

const proxyA = startProxy(9421);
const bA = await launch(9411, proxyA.args);
const pages = [];
const bB = await launch(9412);
const bC = await launch(9413);
try {
  const A = await openPage(bA, "member");
  const B = await openPage(bB, "caretaker");
  const C = await openPage(bC, "viewer");
  pages.push(A, B, C);
  await A.signIn("member@example.com", PW);
  await B.signIn("caretaker@example.com", PW);
  await C.signIn("viewer@example.com", PW);
  for (const p of [A, B, C]) await p.waitFor(`document.querySelectorAll("ol > li").length > 0`, 20000);
  const timelineUrl = await A.evaluate("location.pathname");

  // 1. Add an event, then live notes from its ⋯ menu.
  const tag = `LN-${Date.now()}`;
  await A.press(button("Event"));
  await A.waitFor(`document.querySelector('[role=dialog] input[name="title"]')`);
  await A.type(`document.querySelector('[role=dialog] input[name="title"]')`, `${tag} Dr. Lee visit`);
  await A.press(`document.querySelector('[role=dialog] button[type="submit"]')`);
  await A.waitFor(rowWith(tag));
  await A.press(`${rowWith(tag)}.querySelector('button[aria-label^="Actions"]')`);
  await A.waitFor(menuItem("Add live notes"));
  check("menu: writers can add live notes to an event", true);
  await A.press(menuItem("Add live notes"));
  await A.waitFor(`location.pathname.endsWith("/notes") && ${EDITOR}`, 10000);
  const notesUrl = await A.evaluate("location.pathname");
  check("add: opens the editor on its own page", true, notesUrl);
  check(
    "editor: toolbar for writers",
    await A.evaluate(`!!document.querySelector('[role=toolbar][aria-label="Formatting"]')`),
  );

  // 2. The other caretaker and the viewer open it.
  await B.goto(notesUrl);
  await B.waitFor(EDITOR, 15000);
  await C.goto(notesUrl);
  await C.waitFor(EDITOR, 15000);
  check(
    "viewer: read-only, no toolbar",
    await C.evaluate(
      `${EDITOR}.getAttribute("contenteditable") === "false" && !document.querySelector('[role=toolbar]')`,
    ),
  );

  // 3. Latency: A types, B and C see it.
  const lat = [];
  for (let i = 1; i <= 5; i++) {
    const word = `${tag}-a${i}`;
    const t0 = Date.now();
    await typeInEditor(A, ` ${word}`);
    await B.waitFor(editorHas(word), 15000);
    lat.push(Date.now() - t0);
    await C.waitFor(editorHas(word), 15000);
    await sleep(300);
  }
  lat.sort((x, y) => x - y);
  check("live: caretaker sees the owner's typing", true, `ms: ${lat.join(", ")}; median ${lat[2]}`);
  check("live: viewer watches it update", true);

  // 4. Both type at once; everyone converges on the same text.
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
    texts[0].slice(0, 80),
  );

  // 5. Stored in Postgres, attributed, and only writers' edits.
  await sleep(2000);
  const authors = psql(
    `SELECT string_agg(DISTINCT u.email, ',' ORDER BY u.email) FROM note_update n JOIN "user" u ON u.id = n.created_by WHERE n.document_id = '${notesUrl.split("/")[5]}'`,
  );
  const compacted = psql(
    `SELECT snapshot IS NOT NULL FROM note_document WHERE id = '${notesUrl.split("/")[5]}'`,
  );
  check(
    "server: edits stored as their authors (or already compacted)",
    authors.includes("member@example.com") || compacted === "t",
    `authors: ${authors || "none pending"}; compacted: ${compacted}`,
  );
  check("server: no edits from the viewer", !authors.includes("viewer@example.com"));

  // 6. Offline: A keeps writing; B gets it after reconnecting.
  proxyA.setOnline(false);
  await A.waitFor(`document.body.textContent.includes("Offline")`, 20000).catch(() => undefined);
  const offWord = `${tag}-offline`;
  await newParagraph(A);
  await typeInEditor(A, offWord);
  await sleep(2500);
  check("offline: shows in the editor locally", await A.evaluate(editorHas(offWord)));
  check("offline: the other caretaker doesn't have it yet", !(await B.evaluate(editorHas(offWord))));
  const t0 = Date.now();
  proxyA.setOnline(true);
  await B.waitFor(editorHas(offWord), 30000);
  check("offline: arrives after reconnecting", true, `${Date.now() - t0} ms`);

  // 7. Formatting: a heading made on A shows as a heading on C.
  await newParagraph(A);
  await A.press(`document.querySelector('[aria-label="Heading"]')`);
  // Type where the cursor is (inside the new heading), not at the end of the document.
  await A.send("Input.insertText", { text: `${tag} Questions` });
  await C.waitFor(
    `[...document.querySelectorAll(".ProseMirror h2")].some((h) => h.textContent.includes("${tag} Questions"))`,
    15000,
  );
  check("format: a heading syncs as a heading", true);
  await A.screenshot("ln-owner");
  await C.screenshot("ln-viewer");

  // 8. Back on the timeline: a preview and an Open link, for the viewer too.
  await C.goto(timelineUrl);
  await C.waitFor(`${rowWith(tag)}?.textContent.includes("${tag}-a1")`, 15000);
  check(
    "timeline: preview with an Open link (viewer)",
    await C.evaluate(`!!${rowWith(tag)}.querySelector('a[href$="/notes"]')`),
  );
  check(
    "timeline: viewer has no ⋯ menu",
    !(await C.evaluate(`!!${rowWith(tag)}.querySelector('button[aria-label^="Actions"]')`)),
  );
  await C.screenshot("ln-timeline-viewer");

  // 9. Symptoms and vitals can't have live notes.
  await B.goto(timelineUrl);
  await B.waitFor(`document.querySelectorAll("ol > li").length > 0`);
  const symptomRow = `[...document.querySelectorAll("ol > li")].find((li) => li.textContent.includes("Symptom:"))`;
  if (await B.evaluate(`!!${symptomRow}`)) {
    await B.press(`${symptomRow}.querySelector('button[aria-label^="Actions"]')`);
    await B.waitFor(menuItem("Edit"));
    check("menu: no live notes on a symptom", !(await B.evaluate(`!!${menuItem("Add live notes")}`)));
    await B.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape" });
  }

  // 10. Delete the entry: the open editor says so.
  await C.goto(notesUrl);
  await C.waitFor(EDITOR, 15000);
  await A.goto(timelineUrl);
  await A.waitFor(rowWith(tag));
  await A.press(`${rowWith(tag)}.querySelector('button[aria-label^="Actions"]')`);
  await A.waitFor(menuItem("Delete"));
  await A.press(menuItem("Delete"));
  await A.waitFor(`document.querySelector("dialog[open]")`);
  await A.press(
    `[...document.querySelectorAll("dialog[open] button")].find((b) => b.textContent.trim() === "Delete")`,
  );
  await C.waitFor(`document.body.textContent.includes("This entry was deleted")`, 15000);
  check("delete: an open editor shows the entry is gone", true);

  // Known noise: the proxied browser can't reach Vite's HMR websocket (dev
  // only), PowerSync reports the sync error while that browser is offline,
  // and it warns when a full page load closes the previous page's database
  // (happens on any screen, not just live notes).
  const noise =
    /401|Failed to load resource|\[vite\] failed to connect|Failed to send error to Vite|\[PowerSync\]: Sync error|error closing database connection/;
  const errors = [A, B, C].flatMap((p) => p.errors).filter((e) => !noise.test(e));
  check("no console errors or warnings", errors.length === 0, errors.slice(0, 5).join(" | "));
} catch (e) {
  check("run", false, e.message);
  for (const p of pages) {
    const where = await p
      .evaluate(`location.pathname + " | " + document.body.innerText.slice(0, 300)`)
      .catch(() => "?");
    console.log("  page:", where.replace(/\n+/g, " / "));
    console.log("  errors:", p.errors.slice(0, 5).join(" | "));
  }
} finally {
  for (const b of [bA, bB, bC]) b.proc.kill();
  proxyA.close?.();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
