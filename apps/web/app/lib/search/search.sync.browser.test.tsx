import type { Fixture } from "../../../test/fixtures";

import { parseSearch } from "@caretook/data/schema";
import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { found } from "../../../test/found";
import { renderWithDevice } from "../../../test/device";
import { at, fx, hoursAgo, newId, TEST_GROUP, TEST_USER } from "../../../test/fixtures";
import * as entryRoute from "../../routes/app/groups/entry/route";
import {
  rebuildSearchIndex,
  SEARCH_INDEX_VERSION,
  searchEntryIds,
  searchGroup,
  searchIndexSettled,
  searchIndexStats,
  startSearchIndex,
  stopSearchIndex,
} from "./search.sync";
import { createEntry } from "../timeline/timeline.sync";

// The search index on the test device (from search.mjs, slice 1): the same
// FTS5 index, triggers and indexer as on a phone, on PowerSync's own
// wa-sqlite in this tab. Entries found by every field, the matching rules,
// one group's rows only, a local write, text typed in a note (offline: the
// device always is) found within a second, a delete arriving by sync, a
// format change rebuilding, and about 2,000 entries. The same rules against
// node's SQLite are search.test.ts's; the parser's are search.test.ts in
// packages/data.

const G = TEST_GROUP.id;
const OTHER = { group: newId(), recipient: newId() };
const otherGroup = [
  fx.group({ id: OTHER.group, name: "Okafor Family" }),
  fx.recipient({ id: OTHER.recipient, groupId: OTHER.group, name: "Lou Okafor", preferredName: null }),
  fx.member({ userId: TEST_USER.id, groupId: OTHER.group, role: "owner" }),
];

const SAM = fx.person({ name: "Sam Okafor", role: "caretaker" });
const lark = fx.provider({ name: "Dr. Mira Lark" });
const lisinopril = fx.medication({ name: "Lisinopril" });
const visit = fx.event({ title: "Cardiology checkup", occurredAt: hoursAgo(5) });
const walk = fx.note({ occurredAt: hoursAgo(4), text: "Walking to the mailbox with José, then rested" });
const rest = fx.symptom({ name: "Sore hip", occurredAt: hoursAgo(3), body: "Rested after lunch" });
const dizzy = fx.symptom({ name: "Dizziness", occurredAt: hoursAgo(2), createdBy: SAM.id });
const bp = fx.vital({
  occurredAt: hoursAgo(6),
  readings: [{ type: "bloodPressure", systolic: 128, diastolic: 82 }],
} as never);
const dose = fx.dose({ medicationId: lisinopril.id, occurredAt: hoursAgo(7) });
const theirs = fx.note({
  groupId: OTHER.group,
  recipientId: OTHER.recipient,
  occurredAt: hoursAgo(1),
  text: "Walking to the mailbox",
});
const fixtures: Fixture[] = [
  SAM,
  lark,
  lisinopril,
  visit,
  walk,
  rest,
  dizzy,
  bp,
  dose,
  fx.link(visit.id, lark.id),
  ...otherGroup,
  theirs,
];

const open = (more: Fixture[] = []) =>
  renderWithDevice({ element: <p>device</p>, fixtures: [fixtures, more], search: true });

type Device = Awaited<ReturnType<typeof open>>;
/** The group's matching entry ids, sorted. */
const idsOn =
  (device: Device) =>
  async (text: string, groupId: string = G) =>
    (await searchEntryIds(device.db, groupId, parseSearch(text))).sort();

describe("the index on the device", () => {
  test("it's ready on open, with every entry of the group, and finds an entry by every field", async () => {
    const device = await open();
    const ids = idsOn(device);
    expect(searchIndexStats().status).toBe("ready");
    const items = await device.query<{ n: number }>(
      "SELECT count(*) AS n FROM search_item WHERE group_id = ? AND item_type = 'entry'",
      [G],
    );
    expect(items[0]!.n).toBe(6);
    expect(await ids("checkup")).toEqual([visit.id]); // a title
    expect(await ids("mailbox")).toEqual([walk.id]); // a note's document text
    expect(await ids('"sore hip"')).toEqual([rest.id]); // a symptom's name
    expect(await ids("blood pressure")).toEqual([bp.id]); // a vital's type
    expect(await ids("lisinopril")).toEqual([dose.id]); // a dose's medication
    expect(await ids("lark")).toEqual([visit.id]); // a linked provider
    expect(await ids('"sam okafor"')).toEqual([dizzy.id]); // the author
  });

  test("word forms, a prefix past the stem, case and accents, every word, phrases and exclusions", async () => {
    const device = await open();
    const ids = idsOn(device);
    expect(await ids("walked")).toEqual([walk.id]);
    expect(await ids("walki")).toEqual([walk.id]);
    expect(await ids("JOSE")).toEqual([walk.id]);
    expect(await ids("josé")).toEqual([walk.id]);
    expect(await ids("mailbox lunch")).toEqual([]);
    expect(await ids('"to the mailbox"')).toEqual([walk.id]);
    expect(await ids('"mailbox the to"')).toEqual([]);
    expect(await ids("rested -mailbox")).toEqual([rest.id]);
    expect(await ids("-mailbox")).toEqual([]);
  });

  test("each group finds only its own rows: entries, medications and doses", async () => {
    const device = await open();
    const ids = idsOn(device);
    expect(await ids("mailbox")).toEqual([walk.id]);
    expect(await ids("mailbox", OTHER.group)).toEqual([theirs.id]);
    const theirsFor = await searchGroup(device.db, OTHER.group, parseSearch("lisinopril"));
    expect(theirsFor.medication.total + theirsFor.entry.total).toBe(0);
    const ours = await searchGroup(device.db, G, parseSearch("lisinopril"));
    expect(ours.medication.total).toBe(1);
    // A broad search's entries are all in the group.
    const broad = await ids("a");
    const groups = await device.query<{ group_id: string }>(
      "SELECT DISTINCT group_id FROM timeline_entry WHERE id IN (SELECT value FROM json_each(?))",
      [JSON.stringify(broad)],
    );
    expect(broad.length).toBeGreaterThan(0);
    expect(groups.map((g) => g.group_id)).toEqual([G]);
  });
});

describe("the index follows the device", () => {
  test("a just-written entry is found; one deleted on another device stops matching once that syncs", async () => {
    const device = await open();
    const ids = idsOn(device);
    const result = await createEntry(device.db, G, {
      kind: "symptom",
      details: { name: "Knee pain", severity: 2 },
      body: "After the stairs",
      occurredAt: new Date(Date.now() - 60_000).toISOString(),
      timeZone: "America/Los_Angeles",
    });
    expect(result.ok).toBe(true);
    await device.settle();
    const [written] = await device.query<{ id: string }>(
      "SELECT id FROM timeline_entry WHERE json_extract(details, '$.name') = 'Knee pain'",
    );
    expect(await ids("knee stairs")).toEqual([written!.id]);

    await device.sync({ ...walk, row: { ...walk.row, deleted_at: at() } });
    await device.settle();
    expect(await ids("mailbox")).toEqual([]);
  });

  test("text typed in a note is found within a second, before it's saved anywhere else", async () => {
    const note = fx.note({ occurredAt: hoursAgo(1), text: "Waiting room" });
    const device = await renderWithDevice({
      route: { path: "/app/groups/:groupId/entries/:entryId", module: entryRoute },
      url: `/app/groups/${G}/entries/${note.id}`,
      fixtures: [fixtures, note],
      search: true,
    });
    await expect.poll(() => !!document.querySelector(".ProseMirror")).toBe(true);
    await userEvent.click(await found(() => document.querySelector(".ProseMirror")));
    await userEvent.keyboard(" with the crossword");
    const typed = Date.now();
    // Polling the index without forcing the indexer: what a screen would see.
    const db = device.db;
    let foundAfter = 0;
    while (Date.now() - typed < 3000) {
      if ((await searchEntryIds(db, G, parseSearch("crossword"))).includes(note.id)) {
        foundAfter = Date.now() - typed;
        break;
      }
      await new Promise((r) => setTimeout(r, 25));
    }
    expect(foundAfter).toBeGreaterThan(0);
    expect(foundAfter).toBeLessThanOrEqual(1000);
  });

  test("an index in an old format is rebuilt on the next open, and searches still work", async () => {
    const device = await open();
    const ids = idsOn(device);
    await device.db.powersync.execute("UPDATE search_meta SET value = '0' WHERE key = 'version'");
    await device.db.powersync.execute("DELETE FROM search_item");
    expect(await ids("blood pressure")).toEqual([]);
    // What reopening the database does.
    await stopSearchIndex();
    await startSearchIndex(device.db);
    await searchIndexSettled();
    expect(searchIndexStats().lastRebuild?.rebuilt).toBe(true);
    const [version] = await device.query<{ value: string }>(
      "SELECT value FROM search_meta WHERE key = 'version'",
    );
    expect(version!.value).toBe(String(SEARCH_INDEX_VERSION));
    expect(await ids("blood pressure")).toEqual([bp.id]);
  });
});

describe("about 2,000 entries", () => {
  test("the rebuild takes under 2 s, and a query (ids and the page's sections) under 50 ms", async () => {
    const sentences = [
      "Slept through the night and ate a good breakfast",
      "Walked to the end of the street with the cane",
      "Felt dizzy after standing up quickly, sat down for a while",
      "Physical therapy exercises for the knee, ten of each",
      "Short of breath on the stairs, better after resting",
      "Talked with the pharmacy about the refill schedule",
    ];
    const filler = Array.from({ length: 2000 }, (_, i) =>
      fx.note({
        occurredAt: at(new Date(Date.now() - (70 * 24 + i) * 3_600_000)),
        title: `Filler ${i}`,
        text: `${sentences[i % sentences.length]} ${i}`,
      }),
    );
    const device = await open(filler);
    const rebuild = await rebuildSearchIndex();
    expect(rebuild.items).toBeGreaterThanOrEqual(2000);
    expect(rebuild.ms).toBeLessThan(2000);
    const times: Record<string, number> = {};
    for (const q of ["knee", "short of breath", '"short of breath"', "walk -cane", "pres", "the"]) {
      const parsed = parseSearch(q);
      const runs: number[] = [];
      for (let i = 0; i < 5; i++) {
        const t = performance.now();
        await searchEntryIds(device.db, G, parsed);
        await searchGroup(device.db, G, parsed);
        runs.push(performance.now() - t);
      }
      times[q] = runs.sort((a, b) => a - b)[2]!;
    }
    expect(Math.max(...Object.values(times)), JSON.stringify(times)).toBeLessThan(50);
  });
});
