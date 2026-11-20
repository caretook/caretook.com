// Two-member sync of the sheet's entries (symptoms), plus offline, the viewer
// and sign-out. Notes and events are their documents and have their own
// check (live-notes.mjs); this one covers the sheet path reaching the other
// member: add, edit, delete (the sheets' validation, When's date picker and
// their screens are component tests: timelineSheets.browser.test.tsx), an entry
// written offline (through a switchable proxy, because CDP network emulation
// doesn't cut PowerSync's stream), a read-only viewer, a reschedule's one
// transaction uploading and reaching the other member, the sync matrix (every
// synced table's row on both devices: sync-matrix.mjs), an upload refused by
// permissions (a member demoted while offline), a viewer's task ticked
// offline and their refused title change, and sign-out wiping the
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
const menuItem = (text) =>
  `[...document.querySelectorAll("[role=menuitem]")].find((m) => m.textContent.trim() === ${JSON.stringify(text)})`;
const NAME = `document.querySelector('[role=dialog] input[name="symptomName"]')`;
const SUBMIT = `document.querySelector('[role=dialog] button[type="submit"]')`;
const SHEET = `document.querySelector("[role=dialog]")`;

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
const viewerId = userId("viewer@example.com");
// The viewer's seeded open task (seeds/tasks.ts): ticked offline in 6d, reopened after.
const viewerTask = psql(
  `SELECT id FROM task WHERE group_id = '${DEV_FAMILY}' AND title = 'Pick up groceries' AND assignee_id = '${viewerId}' AND deleted_at IS NULL`,
);
const VIEWER_TASK_TITLE = "Pick up groceries";
const reopenViewerTaskSql = `UPDATE task SET done_at = NULL, done_by = NULL, title = '${VIEWER_TASK_TITLE}' WHERE id = '${viewerTask}' AND (done_at IS NOT NULL OR title <> '${VIEWER_TASK_TITLE}')`;
// A run that died mid-step left it done: open again before anyone loads.
if (viewerTask) psql(reopenViewerTaskSql);
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
const proxyC = startProxy(9323);
const bC = await launch(9313, proxyC.args);
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

  // 3. Delete on A, disappears on B, soft-deleted.
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
    // A viewer's ⋯ is Print alone, on notes and events only (its items: component tests).
    "viewer: no + button, no ⋯ menus but notes' and events' Print, no edit targets",
    await C.evaluate(
      `!${ADD_BUTTON} && !document.querySelector('main ol button[aria-label^="Actions"]:not([aria-label^="Actions for note"]):not([aria-label^="Actions for event"])') && !document.querySelector('main ol [aria-label^="Edit "]')`,
    ),
  );

  // 6a. A reschedule is one local transaction (from upcoming.mjs): a new
  // event with the old one's provider link, document and notes, then the old
  // one cancelled and pointing at it. It uploads as one, and the other
  // member's device gets every row. Its screens are component tests
  // (upcoming/upcomingEvents.browser.test.tsx).
  const reschedTitle = `${tag} resched`;
  const reschedProvider = psql(
    `SELECT id FROM provider WHERE group_id = '${DEV_FAMILY}' AND deleted_at IS NULL ORDER BY name LIMIT 1`,
  );
  const resched = await A.evaluate(`(async () => {
    const { liveEntry, providers, appointments } = await window.caretookModules();
    const db = window.caretookSync;
    const id = crypto.randomUUID();
    const day = 86400000;
    const made = await liveEntry.materializeLiveEntry(db, { id, groupId: ${JSON.stringify(DEV_FAMILY)},
      kind: "event", title: ${JSON.stringify(reschedTitle)}, occurredAt: new Date(Date.now() + 2 * day).toISOString(),
      timeZone: "America/Los_Angeles" });
    const linked = await providers.linkProvider(db, id, ${JSON.stringify(reschedProvider)});
    // An empty Yjs update stands in for typed notes: the reschedule carries them over.
    const now = new Date().toISOString().replace(/Z$/, "000Z");
    await db.powersync.execute("INSERT INTO note_update (id, group_id, document_id, data, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?)",
      [crypto.randomUUID(), ${JSON.stringify(DEV_FAMILY)}, id, "AAA=", now, db.userId]);
    const moved = await appointments.rescheduleEvent(db, id, { occurredAt: new Date(Date.now() + 5 * day).toISOString(),
      endsAt: null, allDay: false, keepOldAsCancelled: true });
    return { id, fresh: moved.ok ? moved.id : null, ok: [made.ok, linked.ok, moved.ok] };
  })()`);
  const reschedOn = async (p) => {
    const [row] = await localRows(
      p,
      `SELECT (SELECT cancelled_at IS NOT NULL AND rescheduled_to = ? FROM timeline_entry WHERE id = ?) AS old,
        (SELECT count(*) FROM timeline_entry WHERE id = ? AND title = ? AND cancelled_at IS NULL) AS fresh,
        (SELECT count(*) FROM timeline_entry_provider WHERE entry_id = ? AND provider_id = ?) AS link,
        (SELECT count(*) FROM note_document WHERE id = ?) AS doc,
        (SELECT count(*) FROM note_update WHERE document_id = ?)
          + (SELECT count(*) FROM note_document WHERE id = ? AND snapshot IS NOT NULL) AS notes`,
      [
        resched.fresh,
        resched.id,
        resched.fresh,
        reschedTitle,
        resched.fresh,
        reschedProvider,
        resched.fresh,
        resched.fresh,
        resched.fresh,
      ],
    );
    return row;
  };
  // The notes are an update, or (once the server compacts) the snapshot.
  const reschedAll = (r) =>
    !!r && r.old === 1 && r.fresh === 1 && r.link === 1 && r.doc === 1 && r.notes >= 1;
  const t0r = Date.now();
  const reschedB = await until(async () => {
    const r = await reschedOn(B);
    return reschedAll(r) ? r : null;
  });
  const reschedServer = psql(
    `SELECT (SELECT rescheduled_to::text FROM timeline_entry WHERE id = '${resched.id}' AND cancelled_at IS NOT NULL)
      || '|' || (SELECT count(*) FROM timeline_entry_provider WHERE entry_id = '${resched.fresh}')
      || '|' || ((SELECT count(*) FROM note_update WHERE document_id = '${resched.fresh}')
        + (SELECT count(*) FROM note_document WHERE id = '${resched.fresh}' AND snapshot IS NOT NULL) > 0)`,
  );
  check(
    "reschedule: one transaction (a new event, its link, document and notes, the old one cancelled) uploads and reaches the other member",
    resched.ok.every(Boolean) && !!reschedB && reschedServer === `${resched.fresh}|1|true`,
    reschedB
      ? `${Date.now() - t0r} ms; server ${reschedServer}`
      : `${JSON.stringify(resched)}; B ${JSON.stringify(await reschedOn(B))}; server ${reschedServer}`,
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

  // 6c and 6d share one offline window (the caretaker's and the viewer's
  // devices), so their reconnects overlap: one PowerSync retry, not two.
  //
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
  // 6d. A viewer's task: viewer@ ticks their own task offline (a tick is
  // all a viewer may do) and forces a title change through the device; on
  // reconnect the tick uploads and member@'s list shows it done by them,
  // while the title change is refused and the next sync puts the server's
  // title back. Client-side navigation through the tab bar: no new page
  // loads or sign-ins.
  const tasksTab = `document.querySelector('nav.dock a[href="/app/groups/${DEV_FAMILY}/tasks"]')`;
  const taskRow = `document.querySelector('main [data-task="${viewerTask}"]')`;
  const doneLine = `${taskRow}?.querySelector("[data-task-due]")?.textContent.trim()`;
  const everyone = `[...document.querySelectorAll("main a")].find((a) => a.textContent.trim() === "Everyone")`;
  const taskOn = async (p) =>
    (await localRows(p, "SELECT title, done_at, done_by FROM task WHERE id = ?", [viewerTask]))[0];
  const refusedTask = `${tag} groceries, refused`;
  // Both task lists while online: the viewer's (Mine), and member@'s on
  // Everyone (the viewer's task isn't Mine).
  await C.press(tasksTab);
  await A.press(tasksTab);
  await C.waitFor(`${taskRow}?.querySelector("[data-task-tick]")`, 20000);
  await A.waitFor(everyone, 20000);
  await A.press(everyone);
  await A.waitFor(`location.search.includes("who=everyone") && ${taskRow}`, 20000);

  proxyB.setOnline(false);
  proxyC.setOnline(false);
  await B.waitFor(`!window.caretookSync.powersync.currentStatus.connected`, 20000);
  await C.waitFor(`!window.caretookSync.powersync.currentStatus.connected`, 20000);
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
  await C.press(`${taskRow}.querySelector("[data-task-tick]")`);
  await C.waitFor(`${taskRow}?.querySelector("[data-task-tick]")?.checked`, 10000);
  await localWrite(C, [
    {
      sql: "UPDATE task SET title = ?, updated_at = ?, updated_by = ? WHERE id = ?",
      params: [refusedTask, localTimestamp(), viewerId, viewerTask],
    },
  ]);
  const ticked = { local: await taskOn(C), queued: await queued(C) };
  const serverDone = psql(`SELECT count(*) FROM task WHERE id = '${viewerTask}' AND done_at IS NOT NULL`);
  check(
    "task: offline, the viewer ticks their own task and forces a title change; both queued",
    !!ticked.local?.done_at &&
      ticked.local?.title === refusedTask &&
      ticked.queued === 2 &&
      serverDone === "0",
    `${ticked.queued} queued, done on the server: ${serverDone}`,
  );

  proxyB.setOnline(true);
  proxyC.setOnline(true);
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

  const doneBy = await waitForSql(
    `SELECT coalesce(done_by::text, '') FROM task WHERE id = '${viewerTask}'`,
    (r) => r !== "",
    60000,
  );
  check("task: on reconnect the tick uploads, done by the viewer", doneBy === viewerId, doneBy);
  const shown = await A.waitFor(`${doneLine}?.startsWith("Done by Dev Viewer")`, 20000).then(
    () => true,
    () => false,
  );
  check(
    "task: the member's list shows it done, with the done-by line",
    shown && (await A.evaluate(`${taskRow}?.dataset.taskState`)) === "done",
    `${await A.evaluate(doneLine)}, ${Date.now() - t2} ms after reconnecting`,
  );
  const titleBack = await until(async () => {
    const row = await taskOn(C);
    return row?.title === VIEWER_TASK_TITLE && (await queued(C)) === 0 ? row : null;
  }, 30000);
  const serverTaskTitle = psql(`SELECT title FROM task WHERE id = '${viewerTask}'`);
  check(
    "task: the viewer's title change is refused, and the next sync restores the title (still done)",
    !!titleBack && serverTaskTitle === VIEWER_TASK_TITLE && !!titleBack.done_at,
    titleBack
      ? `${Date.now() - t2} ms after reconnecting`
      : `device ${(await taskOn(C))?.title}, server ${serverTaskTitle}`,
  );

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
  proxyC.close();
  try {
    if (viewerTask) psql(reopenViewerTaskSql);
    psql(
      `UPDATE timeline_entry SET deleted_at = now() WHERE details->>'name' LIKE '${tag}%' AND deleted_at IS NULL`,
    );
    psql(cleanupSql(matrix, recordedAt));
    psql(
      `UPDATE timeline_entry SET deleted_at = now() WHERE title LIKE '${tag} resched%' AND deleted_at IS NULL`,
    );
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
