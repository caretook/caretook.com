// Two-member sync of the sheet's entries (symptoms), plus offline, the viewer
// and sign-out. Notes and events are their documents and have their own
// check (live-notes.spec.mjs); this one covers the sheet path reaching the other
// member: add, edit, delete (the sheets' validation, When's date picker and
// their screens are component tests: timelineSheets.browser.test.tsx), an entry
// written offline (through a switchable proxy, because Playwright's offline
// doesn't cut PowerSync's stream), a weekly series made offline and its "this
// and later" split reaching the other member, a read-only viewer, a reschedule's one
// transaction uploading and reaching the other member, the sync matrix (every
// synced table's row on both devices: sync-matrix.mjs), an upload refused by
// permissions (a member demoted while offline), a viewer's task ticked
// offline and their refused title change, and sign-out wiping the
// device. Every row it writes has this run's tag, so it passes run after run
// without a reset.
//
// One test, in the old script's order (each step names the old PASS line it
// carries): the devices and their rows are the state each step builds on.
import { execSync } from "node:child_process";
import {
  BASE,
  DEV_FAMILY,
  PASSWORD,
  addButton,
  addToTimeline,
  expect,
  psql,
  signIn as fixtureSignIn,
  signOut,
  test,
  waitFor,
} from "./fixtures.mjs";
import { RECIPIENT_PATCH, SYNC_MATRIX, cleanupSql, localTimestamp, matrixContext } from "./sync-matrix.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** An assertion that is its own reported step (one old PASS line). */
const check = (name, ok, detail = "") =>
  test.step(name, () => {
    expect(ok, detail).toBe(true);
  });
/** Polls Postgres until `holds(result)`; returns the last result. */
const waitForSql = async (sql, holds, ms = 15_000) => {
  const end = Date.now() + ms;
  let last = "";
  while (Date.now() < end) {
    last = psql(sql);
    if (holds(last)) return last;
    await sleep(300);
  }
  return last;
};
/** Polls `fn` (async, in Node) until it's truthy or `ms` pass; returns its last value. */
async function until(fn, ms = 20_000) {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) {
    last = await fn().catch(() => undefined);
    if (last) return last;
    await sleep(250);
  }
  return last;
}
const wf = (page, expr, timeout = 10_000) => waitFor(page, expr, { timeout });
const waits = (page, expr, timeout) =>
  wf(page, expr, timeout).then(
    () => true,
    () => false,
  );
/** React Aria buttons need pointer events before click. */
const press = (page, expr) =>
  page.evaluate(`(() => { const el = ${expr}; if (!el) throw new Error("no element: " + ${JSON.stringify(expr)});
    el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })); el.click(); return true; })()`);

const rowWith = (text) =>
  `[...document.querySelectorAll("main ol > li")].find((li) => li.textContent.includes(${JSON.stringify(text)}))`;
const menuItem = (text) =>
  `[...document.querySelectorAll("[role=menuitem]")].find((m) => m.textContent.trim() === ${JSON.stringify(text)})`;
const NAME = `document.querySelector('[role=dialog] input[name="symptomName"]')`;
const SUBMIT = `document.querySelector('[role=dialog] button[type="submit"]')`;
const SHEET = `document.querySelector("[role=dialog]")`;

/** Add a symptom through the sheet. */
async function addSymptom(page, name) {
  await addToTimeline(page, "Symptom");
  await wf(page, NAME);
  await page.locator('[role=dialog] input[name="symptomName"]').fill(name);
  await press(page, SUBMIT);
  await wf(page, `!${SHEET}`);
}
async function timeUntil(page, expr, ms = 20_000) {
  const t0 = Date.now();
  await wf(page, expr, ms);
  return Date.now() - t0;
}
async function signIn(page, email) {
  await fixtureSignIn(page, email);
  await wf(page, `document.querySelectorAll("main ol > li").length > 0`, 30_000);
}

// The device's local database (window.caretookSync on a check build): reads,
// a write in one transaction, and the upload queue's length.
const localRows = (page, sql, params = []) =>
  page.evaluate(([s, p]) => window.caretookSync.powersync.getAll(s, p), [sql, params]);
const localWrite = (page, statements) =>
  page.evaluate(
    (list) =>
      window.caretookSync.powersync
        .writeTransaction(async (tx) => {
          for (const s of list) await tx.execute(s.sql, s.params);
        })
        .then(() => true),
    statements,
  );
const queued = (page) =>
  page.evaluate(() => window.caretookSync.powersync.getUploadQueueStats().then((s) => s.count));
const rpc = (page, path, json) =>
  page.evaluate(
    ([p, body]) =>
      fetch(`/rpc/${p}`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json", "x-csrf-token": "orpc" },
        body: JSON.stringify({ json: body }),
      }).then((r) => r.status),
    [path, json],
  );

/**
 * A page expression: does the local database's IndexedDB storage still hold
 * `text` anywhere in its bytes (freed pages included)? Resolves to "no file",
 * "open hung" (a delete is queued), "clean" or "holds it". Sign-out keeps the
 * file but vacuums it (lib/sync/client.ts), so "clean" is what a wipe leaves.
 */
const localCopyHolds = (text) => `(async () => {
  if (!(await indexedDB.databases()).some((d) => d.name === "caretook.sqlite")) return "no file";
  const db = await Promise.race([
    new Promise((res, rej) => { const r = indexedDB.open("caretook.sqlite"); r.onsuccess = () => res(r.result); r.onerror = rej; }),
    new Promise((res) => setTimeout(() => res(null), 3000)),
  ]);
  if (!db) return "open hung";
  const needle = ${JSON.stringify(text)};
  const dec = new TextDecoder("latin1");
  let hits = 0;
  const visit = (v) => {
    if (v instanceof ArrayBuffer || ArrayBuffer.isView(v)) {
      const u = v instanceof ArrayBuffer ? new Uint8Array(v) : new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
      if (dec.decode(u).includes(needle)) hits++;
    } else if (v && typeof v === "object") for (const k of Object.keys(v)) visit(v[k]);
  };
  for (const name of db.objectStoreNames) {
    const all = await new Promise((res) => { const r = db.transaction(name).objectStore(name).getAll(); r.onsuccess = () => res(r.result); });
    all.forEach(visit);
  }
  db.close();
  return hits ? "holds it" : "clean";
})()`;

// Known noise: PowerSync reports the dropped stream while a device is offline
// and can fail its first connect after a reset (a 401 while it refetches the
// JWKS), a full page load closes the previous page's database, and a refused
// upload is logged on purpose.
const NOISE =
  /the server refused a change|401|Failed to load resource|ERR_INTERNET_DISCONNECTED|Failed to fetch|\[vite\] failed to connect|Failed to send error to Vite|\[PowerSync\]: Sync error|\[PowerSync\]: Initial connect attempt|error closing database connection|\[PowerSync\]: Sync aborted|Error loading route module/;

test("two members' sheet entries converge; offline, refused uploads, the viewer and sign-out", async ({
  device,
}) => {
  test.setTimeout(170_000);
  const dA = await device("member", { offlineable: true });
  const dB = await device("caretaker", { offlineable: true });
  const dC = await device("viewer", { offlineable: true });
  const [A, B, C] = [dA.page, dB.page, dC.page];

  const userId = (email) => psql(`SELECT id FROM "user" WHERE email = '${email}'`);
  const memberId = userId("member@example.com");
  const caretakerId = userId("caretaker@example.com");
  const viewerId = userId("viewer@example.com");
  // The viewer's seeded open task (seeds/todos.ts): ticked offline in 6d, reopened after.
  const viewerTask = psql(
    `SELECT id FROM todo WHERE group_id = '${DEV_FAMILY}' AND title = 'Pick up groceries' AND assignee_id = '${viewerId}' AND deleted_at IS NULL`,
  );
  const VIEWER_TASK_TITLE = "Pick up groceries";
  const reopenViewerTaskSql = `UPDATE todo SET done_at = NULL, done_by = NULL, title = '${VIEWER_TASK_TITLE}' WHERE id = '${viewerTask}' AND (done_at IS NOT NULL OR title <> '${VIEWER_TASK_TITLE}')`;
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

  try {
    await signIn(B, "caretaker@example.com");
    await signIn(A, "member@example.com");
    await check("both members see the synced timeline", true);

    // 1. Add on A, appears on B, stored as A.
    const name = `${tag} knee pain`;
    const t0 = Date.now();
    await addSymptom(A, name);
    await wf(A, rowWith(name));
    const localMs = Date.now() - t0;
    const remoteMs = await timeUntil(B, rowWith(name));
    await check("add: shows on this device at once", localMs < 2000, `${localMs} ms`);
    await check("add: reaches the other member", true, `${remoteMs + localMs} ms after submit`);
    const author = await waitForSql(
      `SELECT u.email FROM timeline_entry e JOIN "user" u ON u.id = e.created_by WHERE e.details->>'name' = '${name}'`,
      (r) => r !== "",
    );
    await check("add: stored in Postgres as the member", author === "member@example.com", author);

    // 2. Edit on B (a row tap opens the edit sheet), appears on A, stored as B.
    await press(B, `${rowWith(name)}.querySelector('a[aria-label^="Edit "]')`);
    await wf(B, `${SHEET}?.textContent.includes("Edit symptom") && ${NAME}`);
    await B.locator('[role=dialog] input[name="symptomName"]').fill(`${name}, edited`);
    await press(B, SUBMIT);
    const editMs = await timeUntil(A, `${rowWith(name)}?.textContent.includes("edited")`);
    await check("edit: reaches the other member", true, `${editMs} ms`);
    await check(
      "edit: stored as the caretaker",
      (await waitForSql(
        `SELECT u.email FROM timeline_entry e JOIN "user" u ON u.id = e.updated_by WHERE e.details->>'name' = '${name}, edited'`,
        (r) => r !== "",
      )) === "caretaker@example.com",
    );

    // 3. Delete on A, disappears on B, soft-deleted.
    await press(A, `${rowWith(name)}.querySelector('button[aria-label^="Actions"]')`);
    await wf(A, menuItem("Delete"));
    await press(A, menuItem("Delete"));
    await wf(A, `document.querySelector("dialog[open] .btn-error")`);
    await press(A, `document.querySelector("dialog[open] .btn-error")`);
    await wf(A, `!${rowWith(name)}`);
    const delMs = await timeUntil(B, `!${rowWith(name)}`);
    await check("delete: disappears for the other member", true, `${delMs} ms`);
    await check(
      "delete: soft-deleted in Postgres",
      (await waitForSql(
        `SELECT (deleted_at IS NOT NULL)::text FROM timeline_entry WHERE details->>'name' LIKE '${tag}%'`,
        (r) => r === "true",
      )) === "true",
    );

    // 3b. A connector's write through /mcp reaches this device with its "via" tag.
    // The token comes from mintToken.ts (the OAuth dance in process, test-only);
    // the write is the assistant's own HTTP call.
    const viaName = `Claude ${tag}`;
    const viaTitle = `${tag} via note`;
    const token = execSync(
      `pnpm --filter @caretook/data exec tsx ../api/src/connectors/mintToken.ts member@example.com ${DEV_FAMILY} "${viaName}"`,
      {
        env: { ...process.env, NODE_ENV: "development", SEED_USER_PASSWORD: PASSWORD },
        stdio: ["ignore", "pipe", "inherit"],
      },
    )
      .toString()
      .trim();
    const mcp = await fetch(`${BASE}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "add_note", arguments: { title: viaTitle, text: "Written by an assistant." } },
      }),
    });
    const mcpBody = await mcp.json();
    await check(
      "connector: add_note through /mcp is accepted",
      mcp.status === 200 && !mcpBody.result?.isError,
      `${mcp.status} ${JSON.stringify(mcpBody).slice(0, 200)}`,
    );
    const viaMs = await timeUntil(A, `${rowWith(viaTitle)}?.querySelector("[data-via]")`);
    await check(
      "connector: device A shows the note with its via tag",
      (await A.evaluate(`${rowWith(viaTitle)}.querySelector("[data-via]").dataset.via`)) === viaName,
      `${viaMs} ms`,
    );

    // 5. Offline on A.
    const offName = `${tag} offline dizziness`;
    dA.offline(true);
    await check(
      "offline: the header says Offline",
      await waits(A, `document.body.innerText.includes("Offline")`, 20_000),
    );
    await addSymptom(A, offName);
    await wf(A, rowWith(offName));
    await check("offline: the entry shows on this device", true);
    // 5a. A weekly series made offline (appointments-2): the device writes it
    // and its 90 days of visits in one transaction (series.sync.ts). Its
    // sheet and RepeatField are component tests (upcoming/upcomingSeries…).
    const seriesTitle = `${tag} series PT`;
    // The time the series steps add to the run (logged, for the lean budget).
    let seriesMs = 0;
    let tSeries = Date.now();
    const made = await A.evaluate(`(async () => {
      const { series } = await window.caretookModules();
      const tz = "America/Los_Angeles";
      const startsOn = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
        .format(new Date(Date.now() + 86400000));
      const byDay = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"][new Date(startsOn + "T12:00:00Z").getUTCDay()];
      return series.createSeries(window.caretookSync, { groupId: ${JSON.stringify(DEV_FAMILY)}, kind: "event",
        rule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=" + byDay, startsOn, startTime: "10:00", allDay: false, timeZone: tz,
        title: ${JSON.stringify(seriesTitle)}, durationMinutes: 60, place: null, providerIds: [] });
    })()`);
    const visitIds = made.ok
      ? (
          await localRows(A, "SELECT id FROM timeline_entry WHERE series_id = ? ORDER BY series_day", [
            made.seriesId,
          ])
        ).map((r) => r.id)
      : [];
    seriesMs += Date.now() - tSeries;
    await sleep(3000);
    await check(
      "offline: not on the server yet",
      psql(`SELECT count(*) FROM timeline_entry WHERE details->>'name' = '${offName}'`) === "0",
    );
    await check(
      "series: made offline (a weekly series and its visits), not on the server yet",
      made.ok &&
        visitIds.length === made.visits &&
        made.visits >= 12 &&
        psql(`SELECT count(*) FROM appointment_series WHERE id = '${made.seriesId}'`) === "0",
      JSON.stringify(made),
    );
    await check(
      "offline: the other member doesn't have it yet",
      !(await B.evaluate(`!!${rowWith(offName)}`)),
    );
    dA.offline(false);
    const backMs = await timeUntil(B, rowWith(offName), 60_000);
    await check(
      "reconnect: the offline entry reaches the other member",
      true,
      `${backMs} ms after reconnecting`,
    );
    await check(
      "reconnect: the Offline badge clears",
      await waits(A, `!document.body.innerText.includes("Offline")`, 20_000),
    );

    // 6. The viewer: sees it, read-only.
    await signIn(C, "viewer@example.com");
    await wf(C, rowWith(offName), 20_000);
    await check("viewer: sees the timeline, including the offline entry", true);
    await check(
      // A viewer's ⋯ is Print alone, on notes and events only (its items: component tests).
      "viewer: no + button, no ⋯ menus but notes' and events' Print, no edit targets",
      (await addButton(C).count()) === 0 &&
        (await C.evaluate(
          `!document.querySelector('main ol button[aria-label^="Actions"]:not([aria-label^="Actions for note"]):not([aria-label^="Actions for event"])') && !document.querySelector('main ol [aria-label^="Edit "]')`,
        )),
    );

    // 6-series. The series 5a made offline, checked once the viewer is in
    // (it uploads meanwhile): the server holds it and every visit, and the
    // other member's Upcoming shows the visits with the repeat mark
    // (client-side, through the tab bar).
    tSeries = Date.now();
    const idList = visitIds.map((id) => `'${id}'`).join(", ") || "NULL";
    const seriesServer = await waitForSql(
      `SELECT (SELECT count(*) FROM appointment_series WHERE id = '${made.seriesId}') || '|' ||
        (SELECT count(*) FROM timeline_entry WHERE series_id = '${made.seriesId}' AND id IN (${idList}) AND deleted_at IS NULL)`,
      (r) => r === `1|${visitIds.length}`,
      30_000,
    );
    await check(
      "series: on reconnect the server holds the series and its visits (the device's ids)",
      seriesServer === `1|${visitIds.length}`,
      seriesServer,
    );
    const visitsOn = async (page, seriesId) =>
      (
        await localRows(
          page,
          `SELECT id FROM timeline_entry WHERE series_id = ? AND deleted_at IS NULL ORDER BY series_day`,
          [seriesId],
        )
      ).map((r) => r.id);
    const onB = await until(async () => (await visitsOn(B, made.seriesId)).length === visitIds.length);
    const upcomingTab = `document.querySelector('nav.dock a[href="/app/groups/${DEV_FAMILY}/upcoming"]')`;
    const upcomingRow = (id) => `document.querySelector('main [data-upcoming-item="${id}"]')`;
    await press(B, upcomingTab);
    const marked = `${JSON.stringify(visitIds)}.filter((id) => document.querySelector('main [data-upcoming-item="' + id + '"] [data-repeat-mark]')).length`;
    // Upcoming is 90 days ahead, the visits through today + 90: all but possibly the last.
    const shownOnB = await waits(B, `${marked} >= ${visitIds.length - 1}`, 20_000);
    await check(
      "series: the other member's Upcoming shows the visits with the repeat mark",
      !!onB && shownOnB,
      `${await B.evaluate(marked)}/${visitIds.length} marked rows`,
    );

    // Then "this and later" from the third visit (two weeks ahead), a new
    // time and length: the old series ends before it, and its later visits
    // move onto a new series, keeping their ids. One local transaction on A;
    // it uploads during 6a, and the step after 6a checks it on B and the server.
    const splitId = visitIds[2];
    const split = await A.evaluate(`(async () => {
      const { series } = await window.caretookModules();
      return series.applySeriesEdit(window.caretookSync, { visitId: ${JSON.stringify(splitId)}, scope: "later",
        change: { action: "edit", startTime: "14:30", durationMinutes: 45 } });
    })()`);
    const tSplit = Date.now();
    seriesMs += tSplit - tSeries;

    // 6a. A reschedule is one local transaction: a new event with the old
    // one's provider link, document and notes, then the old one cancelled and
    // pointing at it. It uploads as one, and the other member's device gets
    // every row. Its screens are component tests (upcoming/upcomingEvents.browser.test.tsx).
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
    const reschedOn = async (page) => {
      const [row] = await localRows(
        page,
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
    await check(
      "reschedule: one transaction (a new event, its link, document and notes, the old one cancelled) uploads and reaches the other member",
      resched.ok.every(Boolean) && !!reschedB && reschedServer === `${resched.fresh}|1|true`,
      reschedB
        ? `${Date.now() - t0r} ms; server ${reschedServer}`
        : `${JSON.stringify(resched)}; B ${JSON.stringify(await reschedOn(B))}; server ${reschedServer}`,
    );

    // 6a-series. The split reaches the other member and the server: the old series
    // ended (UNTIL), the first two visits still on it, the later ones moved
    // onto the new series at 14:30 with their ids, and B's Upcoming row retimed.
    tSeries = Date.now();
    const kept = visitIds.slice(0, 2);
    const moved = visitIds.slice(2);
    const splitState = (rows) => {
      const by = Object.fromEntries(rows.map((r) => [r.id, r]));
      return {
        ended: /UNTIL=/.test(by.old?.rule ?? ""),
        fresh: by.fresh?.start_time === "14:30",
        kept: kept.filter((id) => by[id]?.series_id === made.seriesId).length,
        moved: moved.filter((id) => by[id]?.series_id === split.seriesId).length,
      };
    };
    const splitDone = (s) => s.ended && s.fresh && s.kept === kept.length && s.moved === moved.length;
    const splitSql = `SELECT 'old' AS id, rule, NULL AS start_time, NULL AS series_id FROM appointment_series WHERE id = ?
      UNION ALL SELECT 'fresh', rule, start_time, NULL FROM appointment_series WHERE id = ?
      UNION ALL SELECT id, NULL, NULL, series_id FROM timeline_entry WHERE deleted_at IS NULL AND id IN (${visitIds.map(() => "?").join(", ")})`;
    const splitOn = async (page) =>
      splitState(await localRows(page, splitSql, [made.seriesId, split.seriesId, ...visitIds]));
    const splitB = await until(async () => {
      const s = await splitOn(B);
      return splitDone(s) ? s : null;
    }, 30_000);
    const retimed = await waits(
      B,
      `${upcomingRow(splitId)}?.querySelector("[data-when]")?.textContent.includes("2:30")`,
    );
    const serverRows = psql(
      `SELECT json_agg(r) FROM (SELECT 'old' AS id, rule, NULL AS start_time, NULL::uuid AS series_id FROM appointment_series WHERE id = '${made.seriesId}'
        UNION ALL SELECT 'fresh', rule, start_time, NULL FROM appointment_series WHERE id = '${split.seriesId}'
        UNION ALL SELECT id::text, NULL, NULL, series_id FROM timeline_entry WHERE deleted_at IS NULL AND id IN (${idList})) r`,
    );
    const splitServer = splitState(JSON.parse(serverRows || "[]"));
    await check(
      `series: "this and later" reaches the other member as the split (old series ended, ${moved.length} later visits moved, ids kept)`,
      !!split.ok && !!splitB && retimed && splitDone(splitServer),
      splitB
        ? `${Date.now() - tSplit} ms after the edit`
        : `${JSON.stringify(split)}; B ${JSON.stringify(await splitOn(B))}; server ${JSON.stringify(splitServer)}; retimed ${retimed}`,
    );
    seriesMs += Date.now() - tSeries;
    console.log(`  series: its steps added ${seriesMs} ms to the run`);

    // 6b. The sync matrix: every synced table's row reaches the other device.
    // care_recipient first (its one uploadable column), before the matrix's
    // allergy clears "No known allergies" on the server.
    const recorded = recordedAt !== "";
    await localWrite(A, [RECIPIENT_PATCH.write(matrix, recorded)]);
    const patched = await until(async () => {
      const [row] = await localRows(B, RECIPIENT_PATCH.read(matrix).sql, RECIPIENT_PATCH.read(matrix).params);
      return row && !!row.recorded !== recorded;
    });
    await check(
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
    const holds = async (page, r) =>
      !!r.rowId &&
      (await localRows(page, `SELECT id FROM "${r.table}" WHERE id = ?`, [r.rowId])).length === 1;
    const missingOn = async (page) => {
      const missing = [];
      for (const r of rows) if (!(await holds(page, r))) missing.push(r.table);
      return missing;
    };
    let missingB = await missingOn(B);
    await until(async () => (missingB = await missingOn(B)).length === 0);
    const matrixMs = Date.now() - t1;
    const missingA = await missingOn(A);
    for (const r of rows)
      await check(
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
    const roleOn = async (page) =>
      (
        await localRows(page, "SELECT role FROM care_group_member WHERE group_id = ? AND user_id = ?", [
          DEV_FAMILY,
          caretakerId,
        ])
      )[0]?.role;
    const titleOn = async (page) =>
      (await localRows(page, "SELECT title FROM timeline_entry WHERE id = ?", [matrix.ids.entry]))[0]?.title;
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
    const taskOn = async (page) =>
      (await localRows(page, "SELECT title, done_at, done_by FROM todo WHERE id = ?", [viewerTask]))[0];
    const refusedTask = `${tag} groceries, refused`;
    // Both task lists while online: the viewer's (Mine), and member@'s on
    // Everyone (the viewer's task isn't Mine).
    await press(C, tasksTab);
    await press(A, tasksTab);
    await wf(C, `${taskRow}?.querySelector("[data-task-tick]")`, 20_000);
    await wf(A, everyone, 20_000);
    await press(A, everyone);
    await wf(A, `location.search.includes("who=everyone") && ${taskRow}`, 20_000);

    dB.offline(true);
    dC.offline(true);
    await wf(B, `!window.caretookSync.powersync.currentStatus.connected`, 20_000);
    await wf(C, `!window.caretookSync.powersync.currentStatus.connected`, 20_000);
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
    await check(
      "refused: demoted on the server while offline, the device still writes as a caretaker",
      demoted === 200 && before.role === "caretaker" && before.title === refusedTitle && before.queued === 1,
      `changeRole ${demoted}, local role ${before.role}, ${before.queued} queued`,
    );
    await press(C, `${taskRow}.querySelector("[data-task-tick]")`);
    await wf(C, `${taskRow}?.querySelector("[data-task-tick]")?.checked`);
    await localWrite(C, [
      {
        sql: "UPDATE todo SET title = ?, updated_at = ?, updated_by = ? WHERE id = ?",
        params: [refusedTask, localTimestamp(), viewerId, viewerTask],
      },
    ]);
    const ticked = { local: await taskOn(C), queued: await queued(C) };
    const serverDone = psql(`SELECT count(*) FROM todo WHERE id = '${viewerTask}' AND done_at IS NOT NULL`);
    await check(
      "todo: offline, the viewer ticks their own task and forces a title change; both queued",
      !!ticked.local?.done_at &&
        ticked.local?.title === refusedTask &&
        ticked.queued === 2 &&
        serverDone === "0",
      `${ticked.queued} queued, done on the server: ${serverDone}`,
    );

    dB.offline(false);
    dC.offline(false);
    const t2 = Date.now();
    const after = await until(async () => {
      const state = { role: await roleOn(B), title: await titleOn(B), queued: await queued(B) };
      return state.role === "viewer" && state.title === noteTitle && state.queued === 0 ? state : null;
    }, 60_000);
    const serverTitle = psql(`SELECT title FROM timeline_entry WHERE id = '${matrix.ids.entry}'`);
    await check(
      "refused: on reconnect the upload is refused, the queue empties and the server's copy comes back",
      !!after && serverTitle === noteTitle,
      after
        ? `${Date.now() - t2} ms after reconnecting`
        : `role ${await roleOn(B)}, title ${await titleOn(B)}, ${await queued(B)} queued, server ${serverTitle}`,
    );
    const refusals = dB.errors.filter((e) => e.includes("the server refused a change"));
    await check(
      "refused: the device logged the server's refusal",
      refusals.length > 0,
      `${refusals.length} logged`,
    );
    const restored = await rpc(A, "careGroup/changeRole", {
      groupId: DEV_FAMILY,
      userId: caretakerId,
      role: "caretaker",
    });
    const back = await until(async () => (await roleOn(B)) === "caretaker");
    await check(
      "refused: the caretaker's role is restored",
      restored === 200 && !!back,
      `changeRole ${restored}`,
    );

    const doneBy = await waitForSql(
      `SELECT coalesce(done_by::text, '') FROM todo WHERE id = '${viewerTask}'`,
      (r) => r !== "",
      60_000,
    );
    await check("todo: on reconnect the tick uploads, done by the viewer", doneBy === viewerId, doneBy);
    const shown = await waits(A, `${doneLine}?.startsWith("Done by Dev Viewer")`, 20_000);
    await check(
      "todo: the member's list shows it done, with the done-by line",
      shown && (await A.evaluate(`${taskRow}?.dataset.taskState`)) === "done",
      `${await A.evaluate(doneLine)}, ${Date.now() - t2} ms after reconnecting`,
    );
    const titleBack = await until(async () => {
      const row = await taskOn(C);
      return row?.title === VIEWER_TASK_TITLE && (await queued(C)) === 0 ? row : null;
    }, 30_000);
    const serverTaskTitle = psql(`SELECT title FROM todo WHERE id = '${viewerTask}'`);
    await check(
      "todo: the viewer's title change is refused, and the next sync restores the title (still done)",
      !!titleBack && serverTaskTitle === VIEWER_TASK_TITLE && !!titleBack.done_at,
      titleBack
        ? `${Date.now() - t2} ms after reconnecting`
        : `device ${(await taskOn(C))?.title}, server ${serverTaskTitle}`,
    );

    // 7. Tidy up, then sign-out wipes the device.
    psql(`UPDATE timeline_entry SET deleted_at = now() WHERE details->>'name' = '${offName}'`);
    await wf(A, `!${rowWith(offName)}`, 15_000);
    await signOut(A);
    await wf(A, `location.pathname === "/sign-in"`, 15_000);
    // The file stays, vacuumed: none of the care data is left in its bytes.
    const left = await A.evaluate(localCopyHolds("Grandma Pat"));
    await check(
      "sign-out: lands on sign-in, and the local database is wiped",
      left === "clean" || left === "no file",
      left,
    );
    await A.goto("/app");
    await wf(A, `location.pathname === "/sign-in"`, 15_000);
    await check("sign-out: /app needs signing in again", true);

    const errors = [dA, dB, dC].flatMap((d) => d.errors).filter((e) => !NOISE.test(e));
    await check(
      "no console errors or warnings",
      errors.length === 0,
      errors.slice(0, 5).join(" | ").slice(0, 800),
    );
  } finally {
    try {
      if (viewerTask) psql(reopenViewerTaskSql);
      psql(
        `UPDATE timeline_entry SET deleted_at = now() WHERE details->>'name' LIKE '${tag}%' AND deleted_at IS NULL`,
      );
      psql(
        `UPDATE timeline_entry SET deleted_at = now() WHERE title LIKE '${tag} via%' AND deleted_at IS NULL`,
      );
      psql(`DELETE FROM oauth_client WHERE name = 'Claude ${tag}'`);
      psql(cleanupSql(matrix, recordedAt));
      psql(
        `UPDATE timeline_entry SET deleted_at = now() WHERE title LIKE '${tag} resched%' AND deleted_at IS NULL`,
      );
      // The series and its visits (both halves of the split).
      psql(
        `UPDATE timeline_entry SET deleted_at = now() WHERE title LIKE '${tag} series%' AND deleted_at IS NULL;
         UPDATE appointment_series SET deleted_at = now() WHERE title LIKE '${tag} series%' AND deleted_at IS NULL`,
      );
      psql(
        `UPDATE care_group_member SET role = 'caretaker' WHERE group_id = '${DEV_FAMILY}' AND user_id = '${caretakerId}' AND role <> 'caretaker'`,
      );
    } catch {
      // Best effort.
    }
  }
});
