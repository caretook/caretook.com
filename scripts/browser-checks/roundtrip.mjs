// Two-member sync of the sheet's entries (symptoms), plus offline, the viewer
// and sign-out. Notes and events are their documents and have their own
// check (live-notes.mjs); this one covers the sheet path: add, edit, delete,
// validation, When's date picker (keyboard, typed, tapped, edit), an entry
// written offline (through a switchable proxy, because CDP network emulation
// doesn't cut PowerSync's stream), a read-only viewer, the sync matrix (every
// synced table's row on both devices: sync-matrix.mjs), an upload refused by
// permissions (a member demoted while offline), and sign-out wiping the
// device. Every row it writes has this run's tag, so it passes run after run
// without a reset.
import { execSync } from "node:child_process";
import { ADD_BUTTON, launch, localCopyHolds, openPage, sleep } from "./cdp.mjs";
import { startProxy } from "./proxy.mjs";
import { RECIPIENT_PATCH, SYNC_MATRIX, cleanupSql, localTimestamp, matrixContext } from "./sync-matrix.mjs";

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
  await p.addToTimeline("Symptom");
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

// The device's local database (window.caretookSync on a check build): reads,
// a write in one transaction, and the upload queue's length.
const localRows = (p, sql, params = []) =>
  p.evaluate(`window.caretookSync.powersync.getAll(${JSON.stringify(sql)}, ${JSON.stringify(params)})`);
const localWrite = (p, statements) =>
  p.evaluate(
    `window.caretookSync.powersync.writeTransaction(async (tx) => { for (const s of ${JSON.stringify(statements)}) await tx.execute(s.sql, s.params); }).then(() => true)`,
  );
const queued = (p) => p.evaluate(`window.caretookSync.powersync.getUploadQueueStats().then((s) => s.count)`);
/** Polls `test` (async, in Node) until it's truthy or `ms` pass; returns its last value. */
async function until(test, ms = 20000) {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) {
    last = await test().catch(() => undefined);
    if (last) return last;
    await sleep(250);
  }
  return last;
}
const rpc = (p, path, json) =>
  p.evaluate(
    `fetch("/rpc/${path}", { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-csrf-token": "orpc" }, body: JSON.stringify({ json: ${JSON.stringify(json)} }) }).then((r) => r.status)`,
  );

const DEV_FAMILY = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";
const userId = (email) => psql(`SELECT id FROM "user" WHERE email = '${email}'`);
const memberId = userId("member@example.com");
const caretakerId = userId("caretaker@example.com");
const tag = `RT-${Date.now().toString(36)}`;
const matrix = matrixContext({
  tag,
  groupId: DEV_FAMILY,
  recipientId: psql(`SELECT id FROM care_recipient WHERE group_id = '${DEV_FAMILY}' ORDER BY id LIMIT 1`),
  userId: memberId,
});
// "No known allergies" as the run found it: the matrix toggles it and puts it back.
const recordedAt = psql(
  `SELECT no_known_allergies_at FROM care_recipient WHERE id = '${matrix.recipientId}'`,
);
const proxyA = startProxy(9321);
const proxyB = startProxy(9322);
const bA = await launch(9311, proxyA.args);
const bB = await launch(9312, proxyB.args);
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
  await A.addToTimeline("Symptom");
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
  await A.addToTimeline("Symptom");
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
    "viewer: no + button, no ⋯ menus, no edit targets",
    await C.evaluate(
      `!${ADD_BUTTON} && !document.querySelector('main ol button[aria-label^="Actions"]') && !document.querySelector('main ol [aria-label^="Edit "]')`,
    ),
  );

  // 6b. The sync matrix: every synced table's row reaches the other device.
  // care_recipient first (its one uploadable column), before the matrix's
  // allergy clears "No known allergies" on the server.
  const recorded = recordedAt !== "";
  await localWrite(A, [RECIPIENT_PATCH.write(matrix, recorded)]);
  const patched = await until(async () => {
    const [row] = await localRows(B, RECIPIENT_PATCH.read(matrix).sql, RECIPIENT_PATCH.read(matrix).params);
    return row && !!row.recorded !== recorded;
  });
  check(
    "matrix: care_recipient (device patch) reaches the other member",
    !!patched,
    recorded ? "cleared No known allergies" : "recorded No known allergies",
  );
  const t1 = Date.now();
  await localWrite(
    A,
    SYNC_MATRIX.filter((r) => r.by === "device").map((r) => r.write(matrix)),
  );
  const rows = SYNC_MATRIX.filter((r) => r.by !== "patch").map((r) => ({
    ...r,
    rowId: r.by === "device" ? r.id(matrix) : psql(r.idSql(matrix)),
  }));
  const holds = async (p, r) =>
    !!r.rowId && (await localRows(p, `SELECT id FROM "${r.table}" WHERE id = ?`, [r.rowId])).length === 1;
  const missingOn = async (p) => {
    const missing = [];
    for (const r of rows) if (!(await holds(p, r))) missing.push(r.table);
    return missing;
  };
  let missingB = await missingOn(B);
  await until(async () => (missingB = await missingOn(B)).length === 0);
  const matrixMs = Date.now() - t1;
  const missingA = await missingOn(A);
  for (const r of rows)
    check(
      `matrix: ${r.table} (${r.by === "device" ? "written on a device" : "server-written"}) is on both devices`,
      !missingB.includes(r.table) && !missingA.includes(r.table),
      [
        missingB.includes(r.table) && "not on the other member's device",
        missingA.includes(r.table) && "gone from the writer's",
        !r.rowId && "no seeded row",
      ]
        .filter(Boolean)
        .join(", "),
    );
  console.log(
    `  matrix: ${rows.length - missingB.length}/${rows.length} tables on the other device ${matrixMs} ms after the write`,
  );

  // 6c. A refused upload: the owner demotes the caretaker while the
  // caretaker's device is offline, still holding writer state; its edit is
  // refused on upload (acknowledged, not retried), and the next sync
  // restores the server's copy.
  const noteTitle = `${tag} matrix note`;
  const refusedTitle = `${noteTitle}, refused`;
  const roleOn = async (p) =>
    (
      await localRows(p, "SELECT role FROM care_group_member WHERE group_id = ? AND user_id = ?", [
        DEV_FAMILY,
        caretakerId,
      ])
    )[0]?.role;
  const titleOn = async (p) =>
    (await localRows(p, "SELECT title FROM timeline_entry WHERE id = ?", [matrix.ids.entry]))[0]?.title;
  proxyB.setOnline(false);
  await B.waitFor(`!window.caretookSync.powersync.currentStatus.connected`, 20000);
  const demoted = await rpc(A, "careGroup/changeRole", {
    groupId: DEV_FAMILY,
    userId: caretakerId,
    role: "viewer",
  });
  await localWrite(B, [
    {
      sql: "UPDATE timeline_entry SET title = ?, updated_at = ?, updated_by = ? WHERE id = ?",
      params: [refusedTitle, localTimestamp(), caretakerId, matrix.ids.entry],
    },
  ]);
  const before = { role: await roleOn(B), title: await titleOn(B), queued: await queued(B) };
  check(
    "refused: demoted on the server while offline, the device still writes as a caretaker",
    demoted === 200 && before.role === "caretaker" && before.title === refusedTitle && before.queued === 1,
    `changeRole ${demoted}, local role ${before.role}, ${before.queued} queued`,
  );
  proxyB.setOnline(true);
  const t2 = Date.now();
  const after = await until(async () => {
    const state = { role: await roleOn(B), title: await titleOn(B), queued: await queued(B) };
    return state.role === "viewer" && state.title === noteTitle && state.queued === 0 ? state : null;
  }, 60000);
  const serverTitle = psql(`SELECT title FROM timeline_entry WHERE id = '${matrix.ids.entry}'`);
  check(
    "refused: on reconnect the upload is refused, the queue empties and the server's copy comes back",
    !!after && serverTitle === noteTitle,
    after
      ? `${Date.now() - t2} ms after reconnecting`
      : `role ${await roleOn(B)}, title ${await titleOn(B)}, ${await queued(B)} queued, server ${serverTitle}`,
  );
  const refusals = B.errors.filter((e) => e.includes("the server refused a change"));
  check("refused: the device logged the server's refusal", refusals.length > 0, `${refusals.length} logged`);
  const restored = await rpc(A, "careGroup/changeRole", {
    groupId: DEV_FAMILY,
    userId: caretakerId,
    role: "caretaker",
  });
  const back = await until(async () => (await roleOn(B)) === "caretaker");
  check("refused: the caretaker's role is restored", restored === 200 && !!back, `changeRole ${restored}`);

  // 7. Tidy up, then sign-out wipes the device.
  psql(`UPDATE timeline_entry SET deleted_at = now() WHERE details->>'name' = '${offName}'`);
  await A.waitFor(`!${rowWith(offName)}`, 15000);
  await A.signOut();
  await A.waitFor(`location.pathname === "/sign-in"`, 15000);
  // The file stays, vacuumed: none of the care data is left in its bytes.
  const left = await A.evaluate(localCopyHolds("Grandma Pat"));
  check(
    "sign-out: lands on sign-in, and the local database is wiped",
    left === "clean" || left === "no file",
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
    /the server refused a change|401|Failed to load resource|ERR_INTERNET_DISCONNECTED|Failed to fetch|\[vite\] failed to connect|Failed to send error to Vite|\[PowerSync\]: Sync error|\[PowerSync\]: Initial connect attempt|error closing database connection|\[PowerSync\]: Sync aborted|Error loading route module/;
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
  proxyB.close();
  try {
    psql(
      `UPDATE timeline_entry SET deleted_at = now() WHERE details->>'name' LIKE '${tag}%' AND deleted_at IS NULL`,
    );
    psql(cleanupSql(matrix, recordedAt));
    psql(
      `UPDATE care_group_member SET role = 'caretaker' WHERE group_id = '${DEV_FAMILY}' AND user_id = '${caretakerId}' AND role <> 'caretaker'`,
    );
  } catch {
    // Best effort.
  }
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
