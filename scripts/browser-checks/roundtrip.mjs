// Two-member sync of the sheet's entries (symptoms), plus offline, the viewer
// and sign-out. Notes and events are their documents and have their own
// check (live-notes.mjs); this one covers the sheet path: add, edit, delete,
// validation, When's date picker (keyboard, typed, tapped, edit), an entry
// written offline (through a switchable proxy, because CDP network emulation
// doesn't cut PowerSync's stream), a read-only viewer,
// and sign-out wiping the device. Every entry it writes has this run's tag,
// so it passes run after run without a reset.
import { execSync } from "node:child_process";
import { launch, openPage, sleep } from "./cdp.mjs";
import { startProxy } from "./proxy.mjs";

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

const rowWith = (text) =>
  `[...document.querySelectorAll("main ol > li")].find((li) => li.textContent.includes(${JSON.stringify(text)}))`;
const button = (text, scope = "document") =>
  `[...${scope}.querySelectorAll("button")].find((b) => b.textContent.trim() === ${JSON.stringify(text)})`;
const menuItem = (text) =>
  `[...document.querySelectorAll("[role=menuitem]")].find((m) => m.textContent.trim() === ${JSON.stringify(text)})`;
const tile = (text) =>
  `[...document.querySelectorAll('[aria-label="Add to the timeline"] a, [aria-label="Add to the timeline"] button')].find((b) => b.textContent.trim() === ${JSON.stringify(text)})`;
const NAME = `document.querySelector('[role=dialog] input[name="symptomName"]')`;
const SUBMIT = `document.querySelector('[role=dialog] button[type="submit"]')`;
const SHEET = `document.querySelector("[role=dialog]")`;

// The When field's date picker (DateTimeField): its segments, its "Pick a
// date" button and the calendar it opens.
const SEGMENTS = `(() => { const s = {}; for (const el of document.querySelectorAll('[role=dialog] [data-type]')) s[el.dataset.type] = el.textContent.trim(); return s; })()`;
const PICK = `document.querySelector('[role=dialog] [aria-label="Pick a date"]')`;
const GRID = `document.querySelector("[role=grid]")`;
const CAL_HEADING = `${GRID}?.closest("[role=dialog]")?.querySelector("h2")?.textContent.trim()`;
const SELECTED_DAY = `document.querySelector("[role=grid] [data-selected]")?.textContent.trim()`;
const FOCUSED_DAY = `(document.activeElement?.closest("[role=grid]") ? document.activeElement.textContent.trim() : null)`;
const dayCell = (day) =>
  `[...document.querySelectorAll("[role=grid] [role=gridcell] > *")].find((c) => c.textContent.trim() === ${JSON.stringify(String(day))} && !c.hasAttribute("data-outside-month"))`;
const dayHeaderOf = (text) =>
  `(${rowWith(text)}?.closest("section")?.querySelector("h3")?.textContent.trim() ?? null)`;
/** The browser's yesterday: day and month numbers, and the calendar's month heading. */
const YESTERDAY = `(() => { const d = new Date(); d.setDate(d.getDate() - 1);
  return { day: String(d.getDate()), month: String(d.getMonth() + 1), heading: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }) }; })()`;
const monthHeading = (s) =>
  `new Date(${Number(s.year)}, ${Number(s.month) - 1}, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })`;
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
const KEY = {
  Tab: ["Tab", "Tab", 9],
  Enter: ["Enter", "Enter", 13, "\r"],
  Escape: ["Escape", "Escape", 27],
  ArrowLeft: ["ArrowLeft", "ArrowLeft", 37],
  ArrowUp: ["ArrowUp", "ArrowUp", 38],
};
const key = (p, name) => pressKey(p, ...KEY[name]);
/** Screenshots of the open calendar: light and dark, at 420 and 1280. */
async function calendarScreenshots(p, name) {
  for (const width of [420, 1280]) {
    await p.send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: width < 600,
    });
    for (const theme of ["light", "dark"]) {
      await p.evaluate(`document.documentElement.dataset.theme = ${JSON.stringify(theme)}`);
      await sleep(300);
      await p.screenshot(`${name}-${width}-${theme}`);
    }
  }
  await p.evaluate(`delete document.documentElement.dataset.theme`);
  await p.send("Emulation.setDeviceMetricsOverride", {
    width: 420,
    height: 900,
    deviceScaleFactor: 1,
    mobile: true,
  });
}

// Waits on state get 10 s: they return as soon as the state is there, and the
// 3–5 s they had timed out at low load on a cold check build (B-93).

/** Add a symptom through the sheet. */
async function addSymptom(p, name) {
  await p.press(tile("Symptom"));
  await p.waitFor(NAME);
  await p.type(NAME, name);
  await p.press(SUBMIT);
  await p.waitFor(`!${SHEET}`, 10000);
}
async function timeUntil(p, expr, ms = 20000) {
  const t0 = Date.now();
  await p.waitFor(expr, ms);
  return Date.now() - t0;
}
async function signIn(p, email) {
  // On a fresh dev server the first load can fail while Vite optimises its deps: one retry.
  await p.signIn(email, PW).catch(async () => {
    await sleep(2000);
    await p.signIn(email, PW);
  });
  await p.waitFor(`document.querySelectorAll("main ol > li").length > 0`, 30000);
}

const tag = `RT-${Date.now().toString(36)}`;
const proxyA = startProxy(9321);
const bA = await launch(9311, proxyA.args);
const bB = await launch(9312);
const bC = await launch(9313);
const pages = [];
try {
  const A = await openPage(bA, "member");
  const B = await openPage(bB, "caretaker");
  const C = await openPage(bC, "viewer");
  pages.push(A, B, C);
  await signIn(B, "caretaker@example.com");
  await signIn(A, "member@example.com");
  check("both members see the synced timeline", true);

  // 1. Add on A, appears on B, stored as A.
  const name = `${tag} knee pain`;
  const t0 = Date.now();
  await addSymptom(A, name);
  await A.waitFor(rowWith(name), 10000);
  const localMs = Date.now() - t0;
  const remoteMs = await timeUntil(B, rowWith(name));
  check("add: shows on this device at once", localMs < 2000, `${localMs} ms`);
  check("add: reaches the other member", true, `${remoteMs + localMs} ms after submit`);
  const author = await waitForSql(
    `SELECT u.email FROM timeline_entry e JOIN "user" u ON u.id = e.created_by WHERE e.details->>'name' = '${name}'`,
    (r) => r !== "",
  );
  check("add: stored in Postgres as the member", author === "member@example.com", author);

  // 2. Edit on B (a row tap opens the edit sheet), appears on A, stored as B.
  await B.press(`${rowWith(name)}.querySelector('a[aria-label^="Edit "]')`);
  await B.waitFor(`${SHEET}?.textContent.includes("Edit symptom") && ${NAME}`);
  await B.type(NAME, `${name}, edited`);
  await B.press(SUBMIT);
  const editMs = await timeUntil(A, `${rowWith(name)}?.textContent.includes("edited")`);
  check("edit: reaches the other member", true, `${editMs} ms`);
  check(
    "edit: stored as the caretaker",
    (await waitForSql(
      `SELECT u.email FROM timeline_entry e JOIN "user" u ON u.id = e.updated_by WHERE e.details->>'name' = '${name}, edited'`,
      (r) => r !== "",
    )) === "caretaker@example.com",
  );

  // 3. Validation stays local: a symptom needs a name.
  await A.press(tile("Symptom"));
  await A.waitFor(NAME);
  await A.press(SUBMIT);
  await A.waitFor(`${NAME}?.getAttribute("aria-invalid") === "true"`, 10000).then(
    () => check("validation: a symptom with no name shows a field error", true),
    async () =>
      check(
        "validation: a symptom with no name shows a field error",
        false,
        await A.evaluate(`${SHEET}?.innerText`),
      ),
  );
  await A.press(button("Cancel", SHEET));
  await A.waitFor(`!${SHEET}`);

  // 4. Delete on A, disappears on B, soft-deleted.
  await A.press(`${rowWith(name)}.querySelector('button[aria-label^="Actions"]')`);
  await A.waitFor(menuItem("Delete"));
  await A.press(menuItem("Delete"));
  await A.waitFor(`document.querySelector("dialog[open] .btn-error")`);
  await A.press(`document.querySelector("dialog[open] .btn-error")`);
  await A.waitFor(`!${rowWith(name)}`, 10000);
  const delMs = await timeUntil(B, `!${rowWith(name)}`);
  check("delete: disappears for the other member", true, `${delMs} ms`);
  check(
    "delete: soft-deleted in Postgres",
    (await waitForSql(
      `SELECT (deleted_at IS NOT NULL)::text FROM timeline_entry WHERE details->>'name' LIKE '${tag}%'`,
      (r) => r === "true",
    )) === "true",
  );

  // 4b. When's date picker: keyboard, typed segments, a tapped day, and the
  // saved day; then the edit sheet's calendar opens on the entry's date.
  const picked = `${tag} picked date`;
  const yesterday = await A.evaluate(YESTERDAY);
  await A.press(tile("Symptom"));
  await A.waitFor(NAME);
  await A.type(NAME, picked);
  const s0 = await A.evaluate(SEGMENTS);
  const sameTime = (s) => s.hour === s0.hour && s.minute === s0.minute && s.dayPeriod === s0.dayPeriod;
  await A.evaluate(`[...document.querySelectorAll('[role=dialog] [data-type]')].at(-1).focus()`);
  await key(A, "Tab");
  await A.waitFor(`document.activeElement === ${PICK}`, 5000, { quiet: true }).catch(() => undefined);
  check(
    "picker: Tab from the segments reaches Pick a date",
    await A.evaluate(`document.activeElement === ${PICK}`),
  );
  await key(A, "Enter");
  await A.waitFor(`${GRID} && ${FOCUSED_DAY}`, 10000);
  check(
    "picker: Enter opens the calendar on the current month, focus on the selected day",
    (await A.evaluate(FOCUSED_DAY)) === s0.day &&
      (await A.evaluate(SELECTED_DAY)) === s0.day &&
      (await A.evaluate(CAL_HEADING)) === (await A.evaluate(monthHeading(s0))),
    `${await A.evaluate(CAL_HEADING)}, ${await A.evaluate(FOCUSED_DAY)}`,
  );
  await key(A, "ArrowLeft");
  await A.waitFor(`${FOCUSED_DAY} === ${JSON.stringify(yesterday.day)}`, 10000).then(
    () => check("picker: arrow keys move the focused day", true),
    async () => check("picker: arrow keys move the focused day", false, await A.evaluate(FOCUSED_DAY)),
  );
  await key(A, "Escape");
  await A.waitFor(`!${GRID}`, 10000);
  // React Aria hands focus back to the button a moment after the popover goes.
  await A.waitFor(`document.activeElement === ${PICK}`, 10000, { quiet: true }).catch(() => undefined);
  check(
    "picker: Escape closes it, focus back on the button, date unchanged",
    (await A.evaluate(`document.activeElement === ${PICK}`)) &&
      (await A.evaluate(SEGMENTS)).day === s0.day &&
      (await A.evaluate(`!!${SHEET}`)),
  );
  await key(A, "Enter");
  await A.waitFor(`${GRID} && ${FOCUSED_DAY}`, 10000);
  await key(A, "ArrowLeft");
  await A.waitFor(`${FOCUSED_DAY} === ${JSON.stringify(yesterday.day)}`, 10000);
  await key(A, "Enter");
  await A.waitFor(`!${GRID}`, 10000);
  const s1 = await A.evaluate(SEGMENTS);
  check(
    "picker: Enter picks the day, keeps the time and closes the calendar",
    s1.day === yesterday.day && s1.month === yesterday.month && sameTime(s1),
    `${s1.month}/${s1.day} ${s1.hour}:${s1.minute}`,
  );
  // Typed segments, then the calendar shows the typed date.
  await A.evaluate(`document.querySelector('[role=dialog] [data-type="day"]').focus()`);
  await key(A, "ArrowUp");
  const typed = await A.evaluate(SEGMENTS);
  await A.tap(PICK);
  await A.waitFor(`${GRID} && ${SELECTED_DAY}`, 10000);
  check(
    "picker: typing still works, and the calendar shows the typed date",
    typed.day !== s1.day &&
      (await A.evaluate(SELECTED_DAY)) === typed.day &&
      (await A.evaluate(CAL_HEADING)) === (await A.evaluate(monthHeading(typed))),
    `typed ${typed.month}/${typed.day}, calendar ${await A.evaluate(CAL_HEADING)} ${await A.evaluate(SELECTED_DAY)}`,
  );
  await calendarScreenshots(A, "roundtrip-calendar");
  await A.tap(dayCell(yesterday.day));
  await A.waitFor(`!${GRID}`, 10000).then(
    () => true,
    () => null,
  );
  const s2 = await A.evaluate(SEGMENTS);
  check(
    "picker: tapping a day sets the date, keeps the time and closes the calendar",
    !(await A.evaluate(`!!${GRID}`)) &&
      s2.day === yesterday.day &&
      s2.month === yesterday.month &&
      sameTime(s2),
    `${s2.month}/${s2.day} ${s2.hour}:${s2.minute}`,
  );
  await A.press(SUBMIT);
  await A.waitFor(`!${SHEET}`, 10000);
  await A.waitFor(rowWith(picked), 10000);
  check(
    "picker: the saved entry is under Yesterday",
    (await A.evaluate(dayHeaderOf(picked))) === "Yesterday",
    await A.evaluate(dayHeaderOf(picked)),
  );
  await A.press(`${rowWith(picked)}.querySelector('a[aria-label^="Edit "]')`);
  await A.waitFor(`${SHEET}?.textContent.includes("Edit symptom") && ${PICK}`, 10000);
  await A.tap(PICK);
  await A.waitFor(`${GRID} && ${SELECTED_DAY}`, 10000);
  check(
    "picker: editing opens the calendar on the entry's date, not today's",
    (await A.evaluate(SELECTED_DAY)) === yesterday.day &&
      (await A.evaluate(CAL_HEADING)) === yesterday.heading,
    `${await A.evaluate(CAL_HEADING)} ${await A.evaluate(SELECTED_DAY)}`,
  );
  await key(A, "Escape");
  await A.waitFor(`!${GRID}`, 10000);
  await A.press(button("Cancel", SHEET));
  await A.waitFor(`!${SHEET}`, 10000);

  // 5. Offline on A.
  const offName = `${tag} offline dizziness`;
  proxyA.setOnline(false);
  await A.waitFor(`document.body.innerText.includes("Offline")`, 20000).then(
    () => check("offline: the header says Offline", true),
    () => check("offline: the header says Offline", false),
  );
  await addSymptom(A, offName);
  await A.waitFor(rowWith(offName), 10000);
  check("offline: the entry shows on this device", true);
  await sleep(3000);
  check(
    "offline: not on the server yet",
    psql(`SELECT count(*) FROM timeline_entry WHERE details->>'name' = '${offName}'`) === "0",
  );
  check("offline: the other member doesn't have it yet", !(await B.evaluate(`!!${rowWith(offName)}`)));
  await A.screenshot("rt-offline-member");
  proxyA.setOnline(true);
  const backMs = await timeUntil(B, rowWith(offName), 60000);
  check("reconnect: the offline entry reaches the other member", true, `${backMs} ms after reconnecting`);
  await A.waitFor(`!document.body.innerText.includes("Offline")`, 20000).then(
    () => check("reconnect: the Offline badge clears", true),
    () => check("reconnect: the Offline badge clears", false),
  );

  // 6. The viewer: sees it, read-only.
  await signIn(C, "viewer@example.com");
  await C.waitFor(rowWith(offName), 20000);
  check("viewer: sees the timeline, including the offline entry", true);
  check(
    "viewer: no add bar, no ⋯ menus, no edit targets",
    await C.evaluate(
      `!document.querySelector('[aria-label="Add to the timeline"]') && !document.querySelector('main ol button[aria-label^="Actions"]') && !document.querySelector('main ol [aria-label^="Edit "]')`,
    ),
  );

  // 7. Tidy up, then sign-out wipes the device.
  psql(`UPDATE timeline_entry SET deleted_at = now() WHERE details->>'name' = '${offName}'`);
  await A.waitFor(`!${rowWith(offName)}`, 15000);
  await A.signOut();
  await A.waitFor(`location.pathname === "/sign-in"`, 15000);
  // The database is deleted, or (while a delete is pending) holds nothing.
  await sleep(1000);
  const left = await A.evaluate(`(async () => {
    if (!(await indexedDB.databases()).some((d) => d.name === "caretook.sqlite")) return "deleted";
    const db = await Promise.race([
      new Promise((res, rej) => { const r = indexedDB.open("caretook.sqlite"); r.onsuccess = () => res(r.result); r.onerror = rej; }),
      new Promise((res) => setTimeout(() => res(null), 3000)),
    ]);
    if (!db) return "delete pending";
    let n = 0;
    for (const name of db.objectStoreNames) {
      n += await new Promise((res) => { const r = db.transaction(name).objectStore(name).count(); r.onsuccess = () => res(r.result); });
    }
    db.close();
    return n === 0 ? "empty" : n + " records";
  })()`);
  check(
    "sign-out: lands on sign-in, and the local database is wiped",
    /deleted|pending|empty/.test(left),
    left,
  );
  await A.goto("/app");
  await A.waitFor(`location.pathname === "/sign-in"`, 15000);
  check("sign-out: /app needs signing in again", true);

  // Known noise: the proxied browser can't reach Vite's HMR websocket (dev
  // only), PowerSync reports the dropped stream while it's offline and can
  // fail its first connect after a reset (a 401 while it refetches the JWKS),
  // and a full page load closes the previous page's database.
  const noise =
    /401|Failed to load resource|ERR_INTERNET_DISCONNECTED|Failed to fetch|\[vite\] failed to connect|Failed to send error to Vite|\[PowerSync\]: Sync error|\[PowerSync\]: Initial connect attempt|error closing database connection|\[PowerSync\]: Sync aborted|Error loading route module/;
  const errors = pages.flatMap((p) => p.errors).filter((e) => !noise.test(e));
  check("no console errors or warnings", errors.length === 0, errors.slice(0, 5).join(" | ").slice(0, 800));
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
  for (const b of [bA, bB, bC]) b.proc.kill();
  proxyA.close();
  try {
    psql(
      `UPDATE timeline_entry SET deleted_at = now() WHERE details->>'name' LIKE '${tag}%' AND deleted_at IS NULL`,
    );
  } catch {
    // Best effort.
  }
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
