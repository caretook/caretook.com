// Live notes slice 8: Share. Three browsers in Dev Family:
// member@ (owner; no share sheet, so the clipboard fallback), viewer@ (a
// stubbed share sheet), and one that starts signed out with the shared
// link (then caretaker@, then admin@, who isn't a member).
import { execSync } from "node:child_process";
import { BASE, launch, openPage, sleep } from "./cdp.mjs";

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

const SHARE = `document.querySelector('main header [data-region="actions"] button[aria-label="Share"]')`;
const bodyHas = (text) => `document.body.textContent.includes(${JSON.stringify(text)})`;
const EDITOR = `document.querySelector(".ProseMirror")`;

// A seeded note with a title, and some of its text.
const [entryId, groupId, title, text] = psql(
  `SELECT e.id || '|' || e.group_id || '|' || e.title || '|' || left(d.text, 30) FROM timeline_entry e JOIN note_document d ON d.id = e.id WHERE e.group_id = '0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001' AND e.kind = 'note' AND e.title IS NOT NULL AND e.deleted_at IS NULL AND length(d.text) >= 10 ORDER BY e.occurred_at DESC LIMIT 1`,
).split("|");
const entryPath = `/app/groups/${groupId}/entries/${entryId}`;
const entryLink = BASE + entryPath;

const bA = await launch(9451);
const bB = await launch(9452);
const bC = await launch(9453);
const pages = [];
try {
  const A = await openPage(bA, "member");
  const B = await openPage(bB, "viewer");
  const C = await openPage(bC, "fresh");
  pages.push(A, B, C);

  // member@: no share sheet. The clipboard is the real one, read back below.
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
  await B.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `window.__shared = []; Navigator.prototype.share = function (d) { window.__shared.push(d); return Promise.resolve(); };
      Navigator.prototype.canShare = () => true;`,
  });

  await A.signIn("member@example.com", PW);
  await B.signIn("viewer@example.com", PW);

  // 1. A draft has nothing to link to yet.
  await A.goto(`/app/groups/${groupId}/entries/new?kind=note`);
  await A.waitFor(`${EDITOR}`, 15000);
  await sleep(500);
  check("draft: no Share until the entry exists", !(await A.evaluate(`!!${SHARE}`)));

  // 2. Without a share sheet, Share copies the link and says so.
  await A.goto(entryPath);
  await A.waitFor(`${SHARE} && ${EDITOR}?.textContent.includes(${JSON.stringify(text)})`, 15000);
  check("share: the button is in the header's actions region", true);
  await A.press(SHARE);
  await A.waitFor(bodyHas("Link copied"), 5000);
  check("fallback: shows 'Link copied'", true);
  const copied = await A.evaluate(`navigator.clipboard.readText()`);
  check("fallback: the clipboard holds the entry's web URL", copied === entryLink, copied);
  await A.screenshot("share-copied");
  await A.waitFor(`!${bodyHas("Link copied")}`, 6000);
  check("fallback: the confirmation goes away", true);

  // 3. A viewer can share too; the share sheet gets the title and URL.
  await B.goto(entryPath);
  await B.waitFor(`${SHARE} && ${bodyHas("You can view this")}`, 15000);
  check("viewer: Share is available", true);
  await B.press(SHARE);
  await B.waitFor(`window.__shared.length === 1`, 5000);
  const shared = await B.evaluate(`window.__shared[0]`);
  check(
    "share sheet: called with the entry's title and web URL",
    shared.title === title && shared.url === entryLink,
    JSON.stringify(shared),
  );
  check("share sheet: no 'Link copied' when the sheet took it", !(await B.evaluate(bodyHas("Link copied"))));

  // 4. A signed-out member opens the link: sign in, then the entry.
  await C.send("Page.navigate", { url: copied });
  await C.waitFor(`location.pathname === "/sign-in" && location.search.includes("redirectTo")`, 15000);
  check("signed out: the link asks to sign in", true);
  check("signed out: the sign-in page shows nothing of the note", !(await C.evaluate(bodyHas(text))));
  await C.type(`document.querySelector('input[name="email"]')`, "caretaker@example.com");
  await C.type(`document.querySelector('input[name="password"]')`, PW);
  await C.press(`document.querySelector('form button[type="submit"]')`);
  await C.waitFor(
    `location.pathname === ${JSON.stringify(entryPath)} && ${EDITOR}?.textContent.includes(${JSON.stringify(text)})`,
    20000,
  );
  check("signed out: after signing in, the link lands on the entry", true);

  // 5. A signed-in non-member gets Not found, and nothing about the entry.
  await C.signOut();
  await C.waitFor(`location.pathname === "/sign-in" || location.pathname === "/"`, 15000);
  await C.signIn("admin@example.com", PW);
  await C.send("Page.navigate", { url: copied });
  await C.waitFor(bodyHas("Not found"), 15000);
  await sleep(500);
  const leak = await C.evaluate(
    `[document.title, document.body.textContent].join(" ").match(${JSON.stringify(`${title}|${text}`)})?.[0] ?? null`,
  );
  check("non-member: Not found, with no title or text", leak === null, leak ?? "");
  check("non-member: no Share button", !(await C.evaluate(`!!${SHARE}`)));
  await C.screenshot("share-non-member");

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
  for (const b of [bA, bB, bC]) b.proc.kill();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
