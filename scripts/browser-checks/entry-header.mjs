// Live notes slice 4: the entry header's time chip and delete. Three browsers
// in Dev Family: member@ (owner), caretaker@ and viewer@.
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
const psql = (sql) =>
  execSync(`docker exec ${PG_CONTAINER} psql -U caretook -d caretook -tAc ${JSON.stringify(sql)}`)
    .toString()
    .trim();
/** Poll Postgres until `test(result)` holds. */
const waitForSql = async (sql, test, ms = 15000) => {
  const end = Date.now() + ms;
  let last = "";
  while (Date.now() < end) {
    last = psql(sql);
    if (test(last)) return last;
    await sleep(300);
  }
  return last;
};

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const ON_ENTRY = `/\\/entries\\/${UUID}$/.test(location.pathname)`;
const tile = (text) =>
  `[...document.querySelectorAll('[aria-label="Add to the timeline"] a, [aria-label="Add to the timeline"] button')].find((b) => b.textContent.trim() === ${JSON.stringify(text)})`;
const button = (text) =>
  `[...document.querySelectorAll("button")].find((b) => b.textContent.trim() === ${JSON.stringify(text)})`;
const EDITOR = `document.querySelector(".ProseMirror")`;
const EDITOR_FOCUSED = `document.activeElement?.classList.contains("ProseMirror")`;
const CHIP = `document.querySelector('main header button[aria-label="Change when it happened"]')`;
const MENU = `document.querySelector('main header [data-region="actions"] button')`;
const HEADER_TIME = `document.querySelector("main header time")`;
const DAY_SEGMENT = `document.querySelector('[role=dialog] [data-type="day"]')`;
/** The day heading above the row containing `text`, or null. */
const dayOfRow = (text) =>
  `(() => { const li = [...document.querySelectorAll("ol > li")].find((li) => li.textContent.includes(${JSON.stringify(text)}));
    return li?.closest("section")?.querySelector("h3")?.textContent ?? null; })()`;
const DAY_MS = 86_400_000;

/** Open the chip, move the day by `steps` (negative = earlier) with the arrow keys, then Done. */
async function shiftDay(p, steps) {
  await p.press(CHIP);
  await p.waitFor(DAY_SEGMENT, 5000);
  await p.evaluate(`${DAY_SEGMENT}.focus()`);
  const key =
    steps < 0
      ? { key: "ArrowDown", code: "ArrowDown", windowsVirtualKeyCode: 40 }
      : { key: "ArrowUp", code: "ArrowUp", windowsVirtualKeyCode: 38 };
  for (let i = 0; i < Math.abs(steps); i++) {
    await p.send("Input.dispatchKeyEvent", { type: "keyDown", ...key });
    await p.send("Input.dispatchKeyEvent", { type: "keyUp", ...key });
  }
  await p.press(button("Done"));
  await p.waitFor(`!${DAY_SEGMENT}`, 5000);
}
const headerTimeMs = (p) => p.evaluate(`new Date(${HEADER_TIME}.dateTime).getTime()`);
const pgOccurredMs = (id) =>
  Number(
    psql(`SELECT (extract(epoch FROM occurred_at) * 1000)::bigint FROM timeline_entry WHERE id = '${id}'`),
  );

const bA = await launch(9451);
const bB = await launch(9452);
const bC = await launch(9453);
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
  const timelineUrl = await A.evaluate("location.pathname");
  const tag = `LN4-${Date.now()}`;

  // 1. A time picked on `new`, before typing, is the saved time.
  await A.press(tile("Note"));
  await A.waitFor(`location.pathname.endsWith("/entries/new") && ${EDITOR_FOCUSED}`, 10000);
  check("draft: writers get the time chip and no ⋯ menu yet", await A.evaluate(`!!${CHIP} && !${MENU}`));
  const startMs = await headerTimeMs(A);
  await shiftDay(A, -2);
  const pickedMs = await headerTimeMs(A);
  check(
    "draft: the chip shows the picked time",
    pickedMs === startMs - 2 * DAY_MS,
    `${(pickedMs - startMs) / DAY_MS} days`,
  );
  check(
    "draft: changing the time alone saves nothing",
    await A.evaluate(`location.pathname.endsWith("/entries/new")`),
  );
  await A.evaluate(`${EDITOR}.focus()`);
  await A.send("Input.insertText", { text: `${tag} written later` });
  await A.waitFor(ON_ENTRY, 5000);
  const entryPath = await A.evaluate("location.pathname");
  const entryId = entryPath.split("/").at(-1);
  await waitForSql(`SELECT count(*) FROM timeline_entry WHERE id = '${entryId}'`, (r) => r === "1");
  const savedMs = pgOccurredMs(entryId);
  check(
    "draft: the time picked before typing is the saved occurredAt",
    Math.abs(savedMs - pickedMs) < 1000,
    `${new Date(savedMs).toISOString()} vs ${new Date(pickedMs).toISOString()}`,
  );

  // 2. Changing the time on a saved entry syncs, and the row moves for everyone.
  await B.goto(timelineUrl);
  await B.waitFor(dayOfRow(tag), 15000);
  const dayBefore = await B.evaluate(dayOfRow(tag));
  await C.goto(entryPath);
  await C.waitFor(`${EDITOR}?.textContent.includes(${JSON.stringify(tag)})`, 15000);
  await shiftDay(A, +1);
  const movedMs = pickedMs + DAY_MS;
  const pgMoved = await waitForSql(
    `SELECT (extract(epoch FROM occurred_at) * 1000)::bigint FROM timeline_entry WHERE id = '${entryId}'`,
    (r) => Math.abs(Number(r) - movedMs) < 1000,
  );
  check(
    "time: the change reaches Postgres",
    Math.abs(Number(pgMoved) - movedMs) < 1000,
    new Date(Number(pgMoved)).toISOString(),
  );
  await B.waitFor(`${dayOfRow(tag)} === "Yesterday"`, 15000);
  check("time: another member's timeline moves the row to its new day", true, `${dayBefore} → Yesterday`);
  await C.waitFor(`Math.abs(new Date(${HEADER_TIME}.dateTime) - ${movedMs}) < 1000`, 15000);
  check("time: a viewer on the page sees the new time", true);

  // 3. Viewers get neither an editable chip nor the ⋯ menu.
  check(
    "viewer: plain time, no chip, no ⋯ menu",
    await C.evaluate(
      `!!${HEADER_TIME} && !${CHIP} && !${MENU} && !document.querySelector('main header [data-region="actions"]')`,
    ),
  );
  await C.screenshot("ln4-viewer");

  // 4. Delete from the header: confirm, soft delete, back to the timeline; others see the deleted state.
  await B.goto(entryPath);
  await B.waitFor(`${EDITOR}?.textContent.includes(${JSON.stringify(tag)})`, 15000);
  await A.press(MENU);
  await A.waitFor(
    `[...document.querySelectorAll("[role=menuitem]")].some((m) => m.textContent.trim() === "Delete")`,
    5000,
  );
  await A.screenshot("ln4-menu");
  await A.press(
    `[...document.querySelectorAll("[role=menuitem]")].find((m) => m.textContent.trim() === "Delete")`,
  );
  await A.waitFor(`document.querySelector("dialog[open]")`, 5000);
  check(
    "delete: asks for confirmation first",
    await A.evaluate(`document.querySelector("dialog[open]").textContent.includes("Delete this note?")`),
  );
  await A.screenshot("ln4-confirm");
  // Cancel keeps it.
  await A.press(
    `[...document.querySelectorAll("dialog[open] button")].find((b) => b.textContent.trim() === "Cancel")`,
  );
  await A.waitFor(`!document.querySelector("dialog[open]")`, 5000);
  await sleep(500);
  check(
    "delete: Cancel keeps the entry",
    await A.evaluate(`location.pathname === ${JSON.stringify(entryPath)} && !!${MENU}`),
  );
  await A.press(MENU);
  await A.waitFor(`document.querySelector("[role=menuitem]")`, 5000);
  await A.press(
    `[...document.querySelectorAll("[role=menuitem]")].find((m) => m.textContent.trim() === "Delete")`,
  );
  await A.waitFor(`document.querySelector("dialog[open]")`, 5000);
  await A.press(
    `[...document.querySelectorAll("dialog[open] button")].find((b) => b.textContent.trim() === "Delete")`,
  );
  await A.waitFor(`location.pathname === ${JSON.stringify(timelineUrl)}`, 10000);
  check("delete: returns to the timeline", true);
  check("delete: the row is gone from the timeline", (await A.evaluate(dayOfRow(tag))) === null);
  const pgDeleted = await waitForSql(
    `SELECT (deleted_at IS NOT NULL)::text FROM timeline_entry WHERE id = '${entryId}'`,
    (r) => r === "true",
  );
  check("delete: soft-deleted in Postgres", pgDeleted === "true", pgDeleted);
  await B.waitFor(`document.body.textContent.includes("This entry was deleted.")`, 15000);
  check("delete: another browser on the entry sees the deleted state", true);
  await C.waitFor(`document.body.textContent.includes("This entry was deleted.")`, 15000);
  check("delete: the viewer sees it too", true);
  await B.screenshot("ln4-deleted");

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
