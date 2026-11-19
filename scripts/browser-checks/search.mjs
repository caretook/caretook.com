// Search (the search PRD). Slice 1, the index on the device: the FTS5 index
// is built after sign-in and found through the device module
// (lib/sync/search.ts, loaded with `window.caretookModules()`): seeded
// entries by title, note text, symptom name, vital type, a dose's
// medication, a linked provider and the author; word forms, case and
// accents, a phrase and an exclusion; text typed in a note offline found
// within a second; an entry deleted elsewhere dropping out after sync; only
// the group's own rows (member@'s two groups); and a format change
// rebuilding the index. Full mode also scales the group up (about 2,000
// entries) to measure the rebuild and a query.
//
// Slice 2, search on the timeline (`?q=`): the magnifier's field narrows the
// list as you type, the URL carries it through a reload and Back, it combines
// with the kind filter and its chip's ✕ clears only it, the empty state and
// the announcement name it, the Next strip and the Upcoming block show only
// matches, paging reaches the oldest match and a new search starts from one
// page; cards at 1280, offline and a viewer.
//
// The query language and the search documents are unit-tested
// (search.test.ts, searchDocument.test.ts; the indexer in
// lib/sync/search.test.ts against SQLite FTS5); the steps here check the
// same rules on a real device, against the seeds and synced data.
//
// Everything it makes carries this run's tag and is soft-deleted (or, for
// the scaled-up rows, deleted) at the end. SMOKE=1: the index on the device,
// one seeded and one written search, and the timeline's search online.
import { execSync } from "node:child_process";
import { launch, openPage, sleep, step, SMOKE } from "./cdp.mjs";
import { startProxy } from "./proxy.mjs";

const PG_CONTAINER = process.env.PG_CONTAINER ?? "caretook-postgres-1";
const PW = process.env.SEED_USER_PASSWORD ?? "caretook-dev-password";
const DEV_FAMILY = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";
const DEV_FAMILY_2 = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8d0001";
const tag = `srch${Date.now().toString(36)}`;

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
const lines = (out) => (out ? out.split("\n") : []);
const waitForSql = async (sql, test, ms = 20000) => {
  const end = Date.now() + ms;
  let last = "";
  while (Date.now() < end) {
    last = psql(sql);
    if (test(last)) return last;
    await sleep(300);
  }
  return last;
};

/** Run `body` in the page with the local database as `db` and the device modules as `search` and `timeline`. */
const onDevice = (p, body) =>
  p.evaluate(`(async () => {
    const db = window.caretookSync;
    if (!db) throw new Error("window.caretookSync isn't there (dev and check builds only)");
    const { search, timeline } = await window.caretookModules();
    ${body}
  })()`);

/** The ids of the group's matching entries on the device, after the index has caught up. */
const findIds = (p, text, groupId = DEV_FAMILY, { settle = true } = {}) =>
  onDevice(
    p,
    `${settle ? "await search.searchIndexSettled();" : ""}
     return search.searchEntryIds(db, ${JSON.stringify(groupId)}, search.parseSearch(${JSON.stringify(text)}));`,
  );

/** Wait until `test(ids)` holds for a search, polling the device without forcing the indexer; returns ms waited. */
const waitForIds = async (p, text, test, ms = 15000, groupId = DEV_FAMILY) => {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (test(await findIds(p, text, groupId, { settle: false }))) return Date.now() - start;
    await sleep(50);
  }
  return null;
};

const containsAll = (found, expected) => expected.every((id) => found.includes(id));
const missing = (found, expected) => expected.filter((id) => !found.includes(id)).length;

const proxy = SMOKE ? null : startProxy(9721);
const browser = await launch(9711, proxy ? proxy.args : []);
const A = await openPage(browser, "A");
const made = [];
const perfIds = [];

try {
  await A.signIn("member@example.com", PW);
  await A.waitFor(`!!window.caretookModules`, 30000);
  await onDevice(A, `await search.searchIndexSettled();`);

  await step("The index on the device", { smoke: true }, async () => {
    const stats = await onDevice(A, `return search.searchIndexStats();`);
    check("the index is ready after sign-in", stats.status === "ready", JSON.stringify(stats.lastRebuild));
    const fts = await onDevice(
      A,
      `return db.powersync.getAll("SELECT count(*) AS n FROM search_item WHERE group_id = ?", [${JSON.stringify(DEV_FAMILY)}]);`,
    );
    const local = await onDevice(
      A,
      `return db.powersync.getAll("SELECT count(*) AS n FROM timeline_entry WHERE group_id = ? AND deleted_at IS NULL", [${JSON.stringify(DEV_FAMILY)}]);`,
    );
    check(
      "every live entry of the group is indexed",
      fts[0].n >= local[0].n,
      `${fts[0].n} items, ${local[0].n} entries`,
    );

    const bp = lines(
      psql(`SELECT id FROM timeline_entry WHERE group_id = '${DEV_FAMILY}' AND kind = 'vital' AND deleted_at IS NULL
            AND details->'readings' @> '[{"type":"bloodPressure"}]'`),
    );
    const found = await findIds(A, "blood pressure");
    check(
      "a vital type finds every blood pressure reading",
      bp.length > 0 && containsAll(found, bp),
      `${bp.length} seeded, ${missing(found, bp)} missing`,
    );
  });

  await step("Seeded entries by every field", async () => {
    const [eventId, eventTitle] = psql(
      `SELECT id || '|' || title FROM timeline_entry WHERE group_id = '${DEV_FAMILY}' AND kind = 'event' AND deleted_at IS NULL
         AND title LIKE '% %' AND title <> 'Event' ORDER BY occurred_at DESC LIMIT 1`,
    ).split("|");
    check("by title", (await findIds(A, `"${eventTitle}"`)).includes(eventId), eventTitle);

    const [noteId, noteText] = psql(
      `SELECT e.id || '|' || d.text FROM timeline_entry e JOIN note_document d ON d.id = e.id
       WHERE e.group_id = '${DEV_FAMILY}' AND e.kind = 'note' AND e.deleted_at IS NULL AND length(d.text) > 40
       ORDER BY e.occurred_at DESC LIMIT 1`,
    ).split(/\|(.*)/s);
    const word = noteText
      .split(/[^\p{L}]+/u)
      .filter((w) => w.length >= 6)
      .sort((a, b) => b.length - a.length)[0];
    check("by a note's document text", (await findIds(A, word)).includes(noteId), word);

    const symptom = psql(
      `SELECT details->>'name' FROM timeline_entry WHERE group_id = '${DEV_FAMILY}' AND kind = 'symptom' AND deleted_at IS NULL
       GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`,
    );
    const symptomIds = lines(
      psql(`SELECT id FROM timeline_entry WHERE group_id = '${DEV_FAMILY}' AND kind = 'symptom' AND deleted_at IS NULL
            AND details->>'name' = '${symptom.replace(/'/g, "''")}'`),
    );
    const bySymptom = await findIds(A, `"${symptom}"`);
    check(
      "by a symptom's name",
      containsAll(bySymptom, symptomIds),
      `${symptom}: ${symptomIds.length} seeded, ${missing(bySymptom, symptomIds)} missing`,
    );

    const doses = lines(
      psql(`SELECT e.id FROM timeline_entry e JOIN medication m ON m.id = (e.details->>'medicationId')::uuid
            WHERE e.group_id = '${DEV_FAMILY}' AND e.kind = 'dose' AND e.deleted_at IS NULL AND m.name = 'Lisinopril'`),
    );
    const byMedication = await findIds(A, "lisinopril");
    check(
      "by a dose's medication name",
      doses.length > 0 && containsAll(byMedication, doses),
      `${doses.length} doses, ${missing(byMedication, doses)} missing`,
    );

    const [linkedEntry, providerName] = psql(
      `SELECT l.entry_id || '|' || p.name FROM timeline_entry_provider l JOIN provider p ON p.id = l.provider_id
       JOIN timeline_entry e ON e.id = l.entry_id
       WHERE l.group_id = '${DEV_FAMILY}' AND e.deleted_at IS NULL AND p.deleted_at IS NULL LIMIT 1`,
    ).split("|");
    check(
      "by a linked provider's name",
      (await findIds(A, providerName)).includes(linkedEntry),
      providerName,
    );

    const [authorId, authorName] = psql(
      `SELECT id || '|' || name FROM "user" WHERE email = 'caretaker@example.com'`,
    ).split("|");
    const authored = lines(
      psql(
        `SELECT id FROM timeline_entry WHERE group_id = '${DEV_FAMILY}' AND created_by = '${authorId}' AND deleted_at IS NULL`,
      ),
    );
    const byAuthor = await findIds(A, `"${authorName}"`);
    check(
      "by the author's name",
      authored.length > 0 && containsAll(byAuthor, authored),
      `${authorName}: ${authored.length} entries, ${missing(byAuthor, authored)} missing`,
    );
  });

  await step("Matching rules on the device", { smoke: true }, async () => {
    const write = (groupId, name, body) =>
      onDevice(
        A,
        `const r = await timeline.createEntry(db, ${JSON.stringify(groupId)}, {
           kind: "symptom", details: { name: ${JSON.stringify(name)}, severity: 2 }, body: ${JSON.stringify(body)},
           occurredAt: new Date(Date.now() - 60000).toISOString(), timeZone: "America/Los_Angeles" });
         if (!r.ok) throw new Error(JSON.stringify(r));
         const rows = await db.powersync.getAll("SELECT id FROM timeline_entry WHERE json_extract(details, '$.name') = ?", [${JSON.stringify(name)}]);
         return rows[0].id;`,
      );
    const walk = await write(DEV_FAMILY, `${tag} Knee`, "Walking to the mailbox with José, then rested");
    const other = await write(DEV_FAMILY, `${tag} Hip`, "Rested after lunch");
    made.push(walk, other);
    check("a just-written entry is found", (await findIds(A, `${tag} knee`)).includes(walk));
    if (SMOKE) return;
    check('"walked" finds "walking"', (await findIds(A, `${tag} walked`)).includes(walk));
    check(
      'a prefix past the stem ("walki") still finds it',
      (await findIds(A, `${tag} walki`)).includes(walk),
    );
    check(
      "case and accents are ignored",
      (await findIds(A, `${tag} JOSE`)).includes(walk) && (await findIds(A, `${tag} josé`)).includes(walk),
    );
    check("every word must match", !(await findIds(A, `${tag} mailbox lunch`)).length);
    check("a phrase matches in order", (await findIds(A, `${tag} "to the mailbox"`)).includes(walk));
    check("a phrase out of order doesn't", !(await findIds(A, `${tag} "mailbox the to"`)).includes(walk));
    const excluded = await findIds(A, `${tag} rested -mailbox`);
    check(
      "an exclusion drops the entry with the word",
      excluded.includes(other) && !excluded.includes(walk),
      JSON.stringify(excluded.length),
    );
    check("an exclusion-only search matches nothing", !(await findIds(A, `-mailbox`)).length);
  });

  await step("Only the group's own rows", async () => {
    const lou = await onDevice(
      A,
      `const r = await timeline.createEntry(db, ${JSON.stringify(DEV_FAMILY_2)}, {
         kind: "symptom", details: { name: "${tag} Knee" }, body: "Walking to the mailbox",
         occurredAt: new Date(Date.now() - 60000).toISOString(), timeZone: "America/Los_Angeles" });
       if (!r.ok) throw new Error(JSON.stringify(r));
       return (await db.powersync.getAll("SELECT id FROM timeline_entry WHERE group_id = ? AND json_extract(details, '$.name') = ?", [${JSON.stringify(DEV_FAMILY_2)}, "${tag} Knee"]))[0].id;`,
    );
    made.push(lou);
    const inPat = await findIds(A, `${tag} knee`);
    const inLou = await findIds(A, `${tag} knee`, DEV_FAMILY_2);
    check(
      "each group finds only its own entry",
      !inPat.includes(lou) && inLou.length === 1 && inLou[0] === lou,
      `${inPat.length}/${inLou.length}`,
    );
    const groups = await onDevice(
      A,
      `await search.searchIndexSettled();
       const r = await search.searchGroup(db, ${JSON.stringify(DEV_FAMILY_2)}, search.parseSearch("lisinopril"));
       const all = await search.searchGroup(db, ${JSON.stringify(DEV_FAMILY)}, search.parseSearch("lisinopril"));
       return { lou: r.medication.total + r.entry.total, pat: all.medication.total };`,
    );
    check(
      "Dev Family 2's page search has none of Dev Family's medications or doses",
      groups.lou === 0 && groups.pat > 0,
      JSON.stringify(groups),
    );
    const rows = await onDevice(
      A,
      `const ids = await search.searchEntryIds(db, ${JSON.stringify(DEV_FAMILY)}, search.parseSearch("a"));
       const rows = await db.powersync.getAll("SELECT DISTINCT group_id FROM timeline_entry WHERE id IN (SELECT value FROM json_each(?))", [JSON.stringify(ids)]);
       return { n: ids.length, groups: rows.map((r) => r.group_id) };`,
    );
    check(
      "a broad search's entries are all in the group",
      rows.n > 0 && rows.groups.length === 1 && rows.groups[0] === DEV_FAMILY,
      JSON.stringify(rows),
    );
  });

  await step("Offline typing, and a delete from elsewhere", async () => {
    // The note's page opens online (its route module loads on first use);
    // the network goes before anything is typed.
    const word = `${tag}offline`;
    const note = `[...document.querySelectorAll('[aria-label="Add to the timeline"] a')].find((a) => a.textContent.trim() === "Note")`;
    await A.waitFor(note, 10000);
    await A.press(note);
    await A.waitFor(`document.querySelector(".ProseMirror")`, 15000);
    proxy.setOnline(false);
    await A.waitFor(`document.body.textContent.includes("Offline")`, 20000).catch(() => undefined);
    await A.press(`document.querySelector(".ProseMirror")`);
    await A.send("Input.insertText", { text: `Typed in the waiting room ${word}` });
    const typedAt = Date.now();
    const ms = await waitForIds(A, word, (ids) => ids.length === 1, 10000);
    check(
      "text typed in a note offline is found",
      ms !== null,
      `${ms === null ? "never" : Date.now() - typedAt} ms after typing`,
    );
    check("…within a second", ms !== null && ms <= 1000, `${ms} ms`);
    const [noteId] = await findIds(A, word);
    if (noteId) made.push(noteId);
    proxy.setOnline(true);

    // Deleted on another device: the server's soft delete reaches this one through sync.
    const [walk] = made;
    await waitForSql(`SELECT count(*) FROM timeline_entry WHERE id = '${walk}'`, (n) => n === "1");
    psql(`UPDATE timeline_entry SET deleted_at = now(), updated_at = now() WHERE id = '${walk}'`);
    const gone = await waitForIds(A, `${tag} knee`, (ids) => !ids.includes(walk), 30000);
    const why =
      gone === null
        ? JSON.stringify({
            server: psql(`SELECT deleted_at IS NOT NULL FROM timeline_entry WHERE id = '${walk}'`),
            device: await onDevice(
              A,
              `return db.powersync.getAll("SELECT deleted_at FROM timeline_entry WHERE id = ?", ["${walk}"]);`,
            ),
            dirty: await onDevice(A, `return db.powersync.getAll("SELECT * FROM search_dirty");`),
            sync: await onDevice(
              A,
              `return db.powersync.currentStatus.toJSON?.() ?? String(db.powersync.currentStatus);`,
            ),
          })
        : `${gone} ms`;
    check("an entry deleted elsewhere stops matching after sync", gone !== null, why);
  });

  await step("A format change rebuilds the index", async () => {
    await onDevice(
      A,
      `await search.searchIndexSettled(); await db.powersync.execute("UPDATE search_meta SET value = '0' WHERE key = 'version'");`,
    );
    await A.send("Page.reload");
    await A.waitFor(`!!window.caretookModules && location.pathname.startsWith("/app/groups/")`, 30000);
    await A.waitFor(`!!window.caretookSync`, 30000);
    const stats = await onDevice(A, `await search.searchIndexSettled(); return search.searchIndexStats();`);
    const version = await onDevice(
      A,
      `return db.powersync.getAll("SELECT value FROM search_meta WHERE key = 'version'");`,
    );
    check(
      "an old version is rebuilt on the next open",
      !!stats.lastRebuild?.rebuilt &&
        version[0]?.value === String(await onDevice(A, "return search.SEARCH_INDEX_VERSION;")),
      `${stats.lastRebuild?.items} items in ${Math.round(stats.lastRebuild?.ms)} ms`,
    );
    check("…and searches still work", (await findIds(A, "blood pressure")).length > 0);
  });

  await step("Search on the timeline", { smoke: true }, async () => {
    // Its own tagged entries: three symptoms, one of them "alpha", and an
    // appointment two days ahead, all carrying `tl`.
    const tl = `${tag}tl`;
    const ids = await onDevice(
      A,
      `const add = async (input) => {
         const r = await timeline.createEntry(db, ${JSON.stringify(DEV_FAMILY)}, { timeZone: "America/Los_Angeles", ...input });
         if (!r.ok) throw new Error(JSON.stringify(r));
       };
       for (const [i, name] of ["alpha", "beta", "gamma"].entries())
         await add({ kind: "symptom", details: { name: "${tl} " + name, severity: 2 }, occurredAt: new Date(Date.now() - (i + 2) * 60000).toISOString() });
       await add({ kind: "event", title: "${tl} visit", occurredAt: new Date(Date.now() + 2 * 86400000).toISOString() });
       await search.searchIndexSettled();
       const rows = await db.powersync.getAll(
         "SELECT id FROM timeline_entry WHERE json_extract(details, '$.name') LIKE ? OR title = ? ORDER BY kind = 'event'",
         ["${tl} %", "${tl} visit"]);
       return rows.map((r) => r.id);`,
    );
    made.push(...ids);
    const visit = ids[3];

    const timelineUrl = (search = "") => `/app/groups/${DEV_FAMILY}/timeline${search}`;
    const rows = (p) =>
      p.evaluate(`[...document.querySelectorAll("[data-view] > li")].map((li) => li.textContent)`);
    const waitRows = async (p, test, ms = 10000) => {
      const end = Date.now() + ms;
      let last = [];
      while (Date.now() < end) {
        last = await rows(p);
        if (test(last)) return last;
        await sleep(100);
      }
      return last;
    };
    const ours = (list) => list.length > 0 && list.every((t) => t.includes(tl));
    const status = (p) => p.evaluate(`document.querySelector("[data-search-status]")?.textContent ?? ""`);
    const query = (p) => p.evaluate(`new URLSearchParams(location.search).get("q")`);
    const typeIn = async (p, text) => {
      await p.press(`document.querySelector("[data-search-field]")`);
      await p.send("Input.insertText", { text });
    };
    const openField = async (p) => {
      await p.press(`document.querySelector('button[aria-label="Search entries"]')`);
      await p.waitFor(`document.activeElement?.matches?.("[data-search-field]")`, 5000);
    };

    await A.goto(timelineUrl());
    await A.waitFor(`document.querySelector("[data-view] > li")`, 20000);
    const vitalsBefore = await A.evaluate(
      `document.querySelector('section[aria-labelledby="latest-vitals"]')?.textContent ?? ""`,
    );
    await openField(A);
    check(
      "the magnifier opens a focused field, over the chips at 420",
      await A.evaluate(`!document.querySelector('nav[aria-label="Show entries"]')?.checkVisibility()`),
    );
    await typeIn(A, tl);
    let list = await waitRows(A, (l) => ours(l) && l.length === 3);
    check(
      "typing narrows the timeline to the matches",
      ours(list) && list.length === 3,
      `${list.length} rows`,
    );
    check("the URL carries q", (await query(A)) === tl);
    check("the result is announced", /^3 entries match/.test(await status(A)), await status(A));
    await typeIn(A, " alpha");
    list = await waitRows(A, (l) => l.length === 1);
    check(
      "…and keeps narrowing as you type",
      list.length === 1 && list[0].includes("alpha"),
      `${list.length} rows`,
    );
    const nextId = await A.evaluate(`document.querySelector("[data-next]")?.dataset.next ?? null`);
    check("the Next strip shows only a match (none for alpha)", nextId === null, String(nextId));
    if (vitalsBefore)
      check(
        "latest vitals is unchanged by the search",
        (await A.evaluate(
          `document.querySelector('section[aria-labelledby="latest-vitals"]')?.textContent ?? ""`,
        )) === vitalsBefore,
      );

    // Reload keeps it; the chip shows it, and its ✕ clears only the search.
    await A.goto(timelineUrl(`?kind=symptom&q=${encodeURIComponent(tl)}`));
    list = await waitRows(A, (l) => ours(l) && l.length === 3);
    check(
      "a reload keeps the search, with the kind filter",
      ours(list) && list.length === 3,
      `${list.length} rows`,
    );
    const chip = `[...document.querySelectorAll('nav[aria-label="Show entries"] a')].find((a) => a.textContent.startsWith("Matching"))`;
    check("an active search is a Matching chip", await A.evaluate(`!!(${chip})`));
    await A.goto(timelineUrl(`?kind=vital&q=${encodeURIComponent(tl)}`));
    await A.waitFor(`document.querySelector("[data-empty]")`, 10000);
    const empty = await A.evaluate(`document.querySelector("[data-empty]").textContent`);
    check("the empty state names the search", empty === `No vitals match “${tl}”.`, empty);
    await A.press(chip);
    await A.waitFor(`!new URLSearchParams(location.search).has("q")`, 5000);
    check(
      "the chip's ✕ clears only the search",
      (await A.evaluate(`new URLSearchParams(location.search).get("kind")`)) === "vital",
    );

    // What's ahead: the Next strip and the Upcoming block show only matches.
    await A.goto(timelineUrl(`?upcoming=1&q=${encodeURIComponent(tl)}`));
    await A.waitFor(`document.querySelector("[data-next]")`, 10000);
    check(
      "the Next strip names the matching appointment",
      (await A.evaluate(`document.querySelector("[data-next]").dataset.next`)) === visit,
    );
    const block = await A.evaluate(
      `[...document.querySelectorAll("[data-upcoming-block] [data-block-view] > li")].map((li) => li.textContent)`,
    );
    check(
      "the Upcoming block shows only matches",
      block.length === 1 && block[0].includes(tl),
      JSON.stringify(block),
    );

    // Back after opening a match comes back to the search.
    await A.goto(timelineUrl(`?q=${encodeURIComponent(`${tl} beta`)}`));
    await waitRows(A, (l) => l.length === 1);
    await A.press(`document.querySelector("[data-view] > li a[aria-label^='Edit']")`);
    await A.waitFor(`location.pathname.endsWith("/edit")`, 10000);
    await A.evaluate(`history.back()`);
    await A.waitFor(`!location.pathname.endsWith("/edit")`, 10000);
    list = await waitRows(A, (l) => l.length === 1);
    check(
      "Back after opening a match keeps the search",
      (await query(A)) === `${tl} beta` && list.length === 1,
    );
    if (SMOKE) return;

    // Paging: 35 matches load 30, then the rest by scrolling; a new search starts from one page.
    const pg = `${tag}pg`;
    const paged = await onDevice(
      A,
      `const out = [];
       for (let i = 0; i < 35; i++) {
         const r = await timeline.createEntry(db, ${JSON.stringify(DEV_FAMILY)}, {
           kind: "symptom", details: { name: "${pg} " + i, severity: 1 },
           occurredAt: new Date(Date.now() - (10 + i) * 60000).toISOString(), timeZone: "America/Los_Angeles" });
         if (!r.ok) throw new Error(JSON.stringify(r));
       }
       const rows = await db.powersync.getAll("SELECT id FROM timeline_entry WHERE json_extract(details, '$.name') LIKE ?", ["${pg} %"]);
       await search.searchIndexSettled();
       return rows.map((r) => r.id);`,
    );
    made.push(...paged);
    await A.goto(timelineUrl(`?q=${pg}`));
    list = await waitRows(A, (l) => l.length === 30);
    check("a search shows one page first", list.length === 30, `${list.length} rows`);
    check("…announced as 30+", (await status(A)).startsWith("30+ entries match"), await status(A));
    for (let i = 0; i < 10 && (await rows(A)).length < 35; i++) {
      await A.evaluate(`document.querySelector("[data-older-entries]").scrollIntoView({ block: "end" })`);
      await sleep(400);
    }
    list = await rows(A);
    const end = await A.evaluate(`document.querySelector("[data-older-entries]")?.textContent ?? ""`);
    check(
      "scrolling reaches the oldest match",
      list.length === 35 && end.includes("every match"),
      `${list.length}, ${end}`,
    );
    await openField(A);
    await A.evaluate(`document.querySelector("[data-search-field]").select()`);
    await A.send("Input.insertText", { text: tag });
    list = await waitRows(A, (l) => l.length === 30 && l.some((t) => t.includes(tl)));
    check("a search change starts again from one page", list.length === 30, `${list.length} rows`);

    // Cards at 1280: the field sits beside the chips.
    await A.send("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await A.goto(timelineUrl(`?q=${encodeURIComponent(tl)}`));
    await waitRows(A, (l) => l.length === 3);
    await A.press(`document.querySelector('button[aria-label="Cards"]')`);
    list = await waitRows(A, (l) => ours(l) && l.length === 3);
    check(
      "cards show the matches at 1280",
      (await A.evaluate(`document.querySelector("[data-view]").dataset.view`)) === "cards" &&
        list.length === 3,
    );
    await openField(A);
    check(
      "from sm the field sits beside the chips",
      await A.evaluate(`document.querySelector('nav[aria-label="Show entries"]').checkVisibility()`),
    );
    await A.press(`document.querySelector('button[aria-label="Rows"]')`);
    await A.send("Emulation.setDeviceMetricsOverride", {
      width: 420,
      height: 900,
      deviceScaleFactor: 1,
      mobile: true,
    });

    // Offline: the search is local.
    await A.goto(timelineUrl());
    await A.waitFor(`document.querySelector("[data-view] > li")`, 20000);
    proxy.setOnline(false);
    await A.waitFor(`document.body.textContent.includes("Offline")`, 20000).catch(() => undefined);
    await openField(A);
    await typeIn(A, `${tl} gamma`);
    list = await waitRows(A, (l) => l.length === 1 && l[0].includes("gamma"));
    check("search works offline", list.length === 1 && list[0].includes("gamma"), `${list.length} rows`);
    proxy.setOnline(true);

    // A viewer searches too, on their own device.
    const viewerBrowser = await launch(9712);
    const V = await openPage(viewerBrowser, "V");
    try {
      await V.signIn("viewer@example.com", PW);
      await waitForSql(
        `SELECT count(*) FROM timeline_entry WHERE id IN ('${ids.join("','")}')`,
        (n) => n === "4",
      );
      await V.goto(timelineUrl(`?q=${encodeURIComponent(tl)}`));
      list = await waitRows(V, (l) => ours(l) && l.length === 3, 30000);
      check("a viewer's timeline searches too", ours(list) && list.length === 3, `${list.length} rows`);
    } finally {
      V.close();
      viewerBrowser.proc.kill();
    }
  });

  await step("Performance with about 2,000 entries", async () => {
    // Fictional filler notes on the server, older than the seeds; deleted at the end.
    const sentences = [
      "Slept through the night and ate a good breakfast",
      "Walked to the end of the street with the cane",
      "Felt dizzy after standing up quickly, sat down for a while",
      "Physical therapy exercises for the knee, ten of each",
      "Short of breath on the stairs, better after resting",
      "Talked with the pharmacy about the refill schedule",
    ];
    const existing = Number(
      psql(`SELECT count(*) FROM timeline_entry WHERE group_id = '${DEV_FAMILY}' AND deleted_at IS NULL`),
    );
    const add = Math.max(0, 2000 - existing);
    const owner = psql(`SELECT id FROM "user" WHERE email = 'member@example.com'`);
    const recipient = psql(`SELECT id FROM care_recipient WHERE group_id = '${DEV_FAMILY}'`);
    const values = sentences.map((s) => `'${s}'`).join(",");
    lines(
      psql(`WITH made AS (
              INSERT INTO timeline_entry (group_id, recipient_id, kind, occurred_at, time_zone, title, created_by, updated_by)
              SELECT '${DEV_FAMILY}', '${recipient}', 'note', now() - interval '70 days' - (n || ' hours')::interval,
                     'America/Los_Angeles', '${tag} perf ' || n, '${owner}', '${owner}'
              FROM generate_series(1, ${add}) n RETURNING id, title)
            INSERT INTO note_document (id, group_id, entry_id, text, created_by, updated_by)
            SELECT id, '${DEV_FAMILY}', id, (ARRAY[${values}])[1 + (hashtext(title) & 2147483647) % ${sentences.length}] || ' ' || title,
                   '${owner}', '${owner}'
            FROM made RETURNING id`),
    ).forEach((id) => perfIds.push(id));
    const syncStart = Date.now();
    let onDeviceCount = 0;
    while (Date.now() - syncStart < 120000) {
      onDeviceCount = await onDevice(
        A,
        `return (await db.powersync.getAll("SELECT count(*) AS n FROM timeline_entry WHERE title LIKE ?", ["${tag} perf %"]))[0].n;`,
      );
      if (onDeviceCount === add) break;
      await sleep(500);
    }
    check(
      "the scaled-up entries reach the device",
      onDeviceCount === add,
      `${onDeviceCount} of ${add} added to ${existing}, ${Date.now() - syncStart} ms`,
    );
    const timing = await onDevice(
      A,
      `await search.searchIndexSettled();
       const batch = search.searchIndexStats().lastBatch;
       const rebuild = await search.rebuildSearchIndex();
       const items = (await db.powersync.getAll("SELECT count(*) AS n FROM search_item"))[0].n;
       const times = {};
       for (const q of ["knee", "short of breath", '"short of breath"', "walk -cane", "pres", "the"]) {
         const parsed = search.parseSearch(q);
         const runs = [];
         for (let i = 0; i < 5; i++) {
           const t = performance.now();
           await search.searchEntryIds(db, ${JSON.stringify(DEV_FAMILY)}, parsed);
           await search.searchGroup(db, ${JSON.stringify(DEV_FAMILY)}, parsed);
           runs.push(performance.now() - t);
         }
         runs.sort((a, b) => a - b);
         times[q] = Math.round(runs[2] * 10) / 10;
       }
       return {
         syncBatch: batch && { items: batch.items, ms: Math.round(batch.ms) },
         rebuildMs: Math.round(rebuild.ms), rebuiltItems: rebuild.items, items, times,
       };`,
    );
    console.log(`MEASURE  ${JSON.stringify(timing)}`);
    check(
      "the rebuild takes under 2 s",
      timing.rebuildMs < 2000,
      `${timing.rebuiltItems} items in ${timing.rebuildMs} ms`,
    );
    const slowest = Math.max(...Object.values(timing.times));
    check(
      "a query (ids and the page's sections) takes under 50 ms",
      slowest < 50,
      `median per query, slowest ${slowest} ms: ${JSON.stringify(timing.times)}`,
    );
  });
} catch (e) {
  check("the check ran to the end", false, e.stack ?? String(e));
  console.log(await A.diagnose?.().catch(() => ""));
} finally {
  const all = made.filter(Boolean);
  if (all.length)
    psql(
      `UPDATE timeline_entry SET deleted_at = now(), updated_at = now() WHERE id IN ('${all.join("','")}') AND deleted_at IS NULL`,
    );
  if (perfIds.length) psql(`DELETE FROM timeline_entry WHERE title LIKE '${tag} perf %'`);
  A.close();
  browser.proc.kill();
  proxy?.close?.();
}

const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
