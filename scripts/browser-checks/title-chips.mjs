// Event title suggestions (live notes UX, slice 3): an unnamed event shows
// one-tap chips with the group's recent event titles. Event, then a chip:
// a named event in 2 taps. The chips go once a title is typed, leave out
// deleted entries, work offline, and aren't shown to viewers. Two browsers:
// member@ (owner, through a switchable proxy for the offline check) and
// viewer@, both in Dev Family.
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

const tile = (text) =>
  `[...document.querySelectorAll('[aria-label="Add to the timeline"] a, [aria-label="Add to the timeline"] button')].find((b) => b.textContent.trim() === ${JSON.stringify(text)})`;
const TITLE = `document.querySelector("main header input")`;
const EDITOR = `document.querySelector(".ProseMirror")`;
const CHIPS = `[...document.querySelectorAll('main header [aria-label="Suggested titles"] button')]`;
const chipTexts = (p) => p.evaluate(`${CHIPS}.map((b) => b.textContent.trim())`);
const chip = (text) => `${CHIPS}.find((b) => b.textContent.trim() === ${JSON.stringify(text)})`;
const localTitle = (id) =>
  `window.caretookSync.powersync.getAll("SELECT title FROM timeline_entry WHERE id = '${id}'").then((r) => r[0]?.title ?? null)`;
const ENTRY_URL = /\/entries\/[0-9a-f-]{36}$/;
const entryId = (path) => path.split("/")[5];

/** A real tap (mouse press and release) at the centre of an element. Counted, for the 2-tap check. */
let taps = 0;
async function tap(p, selector) {
  const rect = await p.evaluate(`(() => { const el = ${selector}; if (!el) return null;
    el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  if (!rect) throw new Error(`nothing to tap: ${selector}`);
  await sleep(100);
  for (const type of ["mousePressed", "mouseReleased"]) {
    await p.send("Input.dispatchMouseEvent", { type, ...rect, button: "left", clickCount: 1 });
  }
  taps++;
}

/** From the timeline, start a new event: the draft, with the cursor in its document. */
async function startEvent(p, timelineUrl) {
  if ((await p.evaluate("location.pathname")) !== timelineUrl) {
    await p.evaluate(`document.querySelector('a[href$="/timeline"]')?.click()`);
    await p.waitFor(`location.pathname === ${JSON.stringify(timelineUrl)} && ${tile("Event")}`, 15000);
  }
  await tap(p, tile("Event"));
  await p.waitFor(
    `/\\/entries\\/new$/.test(location.pathname) && document.activeElement?.classList.contains("ProseMirror")`,
    15000,
  );
}

const proxyM = startProxy(9431);
const bM = await launch(9441, proxyM.args);
const bV = await launch(9442);
const pages = [];
try {
  const M = await openPage(bM, "member");
  const V = await openPage(bV, "viewer");
  pages.push(M, V);
  await M.signIn("member@example.com", PW);
  await V.signIn("viewer@example.com", PW);
  for (const p of [M, V]) await p.waitFor(`document.querySelectorAll("ol > li").length > 0`, 20000);
  const timelineUrl = await M.evaluate("location.pathname");
  const tag = `TC-${Date.now()}`;

  // 1. A new event shows the group's recent titles, from the seeds.
  const eventsBefore = psql(`SELECT count(*) FROM timeline_entry WHERE kind = 'event'`);
  taps = 0;
  await startEvent(M, timelineUrl);
  await M.waitFor(`${CHIPS}.length > 0`, 10000);
  const seeded = await chipTexts(M);
  check(
    'chips: a new event shows up to 5 recent titles, such as "Physical therapy"',
    seeded.length <= 5 && seeded.includes("Physical therapy") && !seeded.includes("Event"),
    seeded.join(" · "),
  );
  check(
    "chips: showing them saves nothing",
    psql(`SELECT count(*) FROM timeline_entry WHERE kind = 'event'`) === eventsBefore,
  );
  await M.screenshot("tc-chips");

  // 2. One tap names it: the draft is saved with that title, the URL replaced, the chips gone.
  await tap(M, chip("Physical therapy"));
  await M.waitFor(`${ENTRY_URL.toString()}.test(location.pathname)`, 10000);
  const namedId = entryId(await M.evaluate("location.pathname"));
  await M.waitFor(`${TITLE}?.value === "Physical therapy" && ${CHIPS}.length === 0`, 10000);
  check("chip tap: names the event; Event + chip is 2 taps", taps === 2, `${taps} taps`);
  check(
    "chip tap: saved locally with that title, and the cursor is in the document",
    (await M.evaluate(localTitle(namedId))) === "Physical therapy" &&
      (await M.evaluate(`document.activeElement === ${EDITOR}`)),
  );
  await sleep(2000);
  check(
    "chip tap: stored in Postgres",
    psql(`SELECT title FROM timeline_entry WHERE id = '${namedId}'`) === "Physical therapy",
  );

  // 3. Typing a title hides them; clearing it brings them back; a custom title saves.
  await startEvent(M, timelineUrl);
  await M.waitFor(`${CHIPS}.length > 0`, 10000);
  await M.evaluate(`${TITLE}.focus()`);
  await M.type(TITLE, `${tag} Podiatrist`);
  await M.waitFor(`${CHIPS}.length === 0`, 3000);
  check("typing: the chips disappear once a title is typed", true);
  await M.type(TITLE, "");
  await M.waitFor(`${CHIPS}.length > 0`, 3000);
  check("typing: clearing the field brings them back", true);
  await M.type(TITLE, `${tag} Podiatrist`);
  await M.evaluate(`${TITLE}.blur()`);
  await M.waitFor(`${ENTRY_URL.toString()}.test(location.pathname)`, 10000);
  const customId = entryId(await M.evaluate("location.pathname"));
  await M.waitFor(`${TITLE}?.value === "${tag} Podiatrist"`, 10000);
  check("typing: a custom title saves, with no chips", (await chipTexts(M)).length === 0);

  // 4. The custom title is now a suggestion; once it's deleted, it isn't.
  await startEvent(M, timelineUrl);
  await M.waitFor(`${CHIPS}.length > 0`, 10000);
  // "Physical therapy" now has two uses (the seed and step 2), so it stays ahead of a one-off.
  const ranked = await chipTexts(M);
  check(
    "ranking: a title just used is suggested, behind one used more often",
    ranked[0] === "Physical therapy" && ranked[1] === `${tag} Podiatrist`,
    ranked.join(" · "),
  );
  await M.evaluate(
    `window.caretookSync.powersync.execute("UPDATE timeline_entry SET deleted_at = ? WHERE id = ?", [new Date().toISOString(), "${customId}"])`,
  );
  await M.waitFor(`!${CHIPS}.some((b) => b.textContent.includes(${JSON.stringify(tag)}))`, 10000);
  check("deleted: a deleted event's title is left out", (await chipTexts(M)).length > 0);

  // 5. An event saved as "Event" still shows them, and a chip renames it. Viewers get none.
  await M.send("Input.insertText", { text: `${tag} unnamed` });
  await M.waitFor(`${ENTRY_URL.toString()}.test(location.pathname)`, 10000);
  const unnamedUrl = await M.evaluate("location.pathname");
  const unnamedId = entryId(unnamedUrl);
  await M.waitFor(`${TITLE}?.placeholder === "Add a title" && ${CHIPS}.length > 0`, 10000);
  check('saved as "Event": the chips stay until it has a name', true);
  await V.waitFor(
    `[...document.querySelectorAll("ol > li")].some((li) => li.textContent.includes("${tag} unnamed"))`,
    20000,
  );
  await V.goto(unnamedUrl);
  await V.waitFor(EDITOR, 15000);
  check(
    "viewer: no chips on an unnamed event",
    await V.evaluate(`!document.querySelector('[aria-label="Suggested titles"]')`),
  );
  const pick = (await chipTexts(M))[0];
  await tap(M, chip(pick));
  await M.waitFor(`${TITLE}?.value === ${JSON.stringify(pick)} && ${CHIPS}.length === 0`, 10000);
  await M.waitFor(`${localTitle(unnamedId)}.then((t) => t === ${JSON.stringify(pick)})`, 10000);
  check("rename: a chip renames an existing unnamed event", true, pick);
  await V.waitFor(
    `document.querySelector("main header")?.textContent.includes(${JSON.stringify(pick)})`,
    15000,
  );
  check("rename: reaches the viewer", true);

  // 6. Offline: they're read from the device.
  proxyM.setOnline(false);
  await M.waitFor(`document.body.textContent.includes("Offline")`, 20000).catch(() => undefined);
  await startEvent(M, timelineUrl);
  await M.waitFor(`${CHIPS}.length > 0`, 10000);
  check("offline: the chips still show", true, (await chipTexts(M)).join(" · "));
  proxyM.setOnline(true);
  await M.screenshot("tc-offline");

  // Known noise, as in live-notes.mjs: the proxied browser can't reach Vite's
  // HMR websocket, PowerSync reports the sync error while offline, and a full
  // page load closes the previous page's database.
  const noise =
    /401|Failed to load resource|\[vite\] failed to connect|Failed to send error to Vite|\[PowerSync\]: Sync error|error closing database connection/;
  const errors = [M, V].flatMap((p) => p.errors).filter((e) => !noise.test(e));
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
  for (const b of [bM, bV]) b.proc.kill();
  proxyM.close?.();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
