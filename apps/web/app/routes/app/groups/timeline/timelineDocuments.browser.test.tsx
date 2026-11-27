import { describe, expect, test } from "vitest";
import { PAGE_SIZE } from "~/lib/core/paging";
import { fx, TEST_GROUP } from "../../../../../test/fixtures";
import { waitUntil } from "../../../../../test/found";
import { PREVIEWS_SQL, recordReads } from "../../../../../test/reads";
import { openTimeline, rows } from "./timelineWorld";

// The timeline reads only the documents of the entries it shows (B-313):
// its previews' query covers the window's entries, never the group's every
// note document, and every shown note still has its preview.

/** A row shows `text` as a paragraph of its own (not as part of a longer one). */
const shows = (text: string) =>
  rows().some((li) => [...li.querySelectorAll("p")].some((p) => p.textContent?.trim() === text));

describe("the timeline's note previews", () => {
  test("read only the window's documents; every shown note keeps its preview", async () => {
    const reads = recordReads(PREVIEWS_SQL);
    const device = await openTimeline();
    await waitUntil(() => rows().length > 0, "the timeline");

    // The window: the newest page and one more (the history's own order).
    const windowIds = (
      await device.query<{ id: string }>(
        `SELECT id FROM timeline_entry WHERE group_id = ? AND deleted_at IS NULL
         ORDER BY occurred_at DESC, id DESC LIMIT ?`,
        [TEST_GROUP.id, PAGE_SIZE + 1],
      )
    ).map((r) => r.id);
    const notes = await device.query<{ id: string; text: string }>(
      `SELECT d.id, d.text FROM note_document d JOIN timeline_entry e ON e.id = d.id
       WHERE d.group_id = ? AND e.kind = 'note'`,
      [TEST_GROUP.id],
    );
    const outside = notes.filter((d) => !windowIds.includes(d.id));
    const inside = notes.filter((d) => windowIds.slice(0, PAGE_SIZE).includes(d.id));
    // The world has notes past the first page, and on it.
    expect(outside.length).toBeGreaterThan(0);
    expect(inside.length).toBeGreaterThan(0);

    // Another member edits a note further down: it arrives, but isn't read.
    const far = outside[0]!.id;
    await device.sync([fx.document({ ownerId: far, text: "Changed further down" })]);
    await device.settle();

    // The loader's read and the live query's answers.
    expect(reads.length).toBeGreaterThanOrEqual(2);
    for (const read of reads) {
      expect(read.params).toContain(PAGE_SIZE + 1);
      expect(read.params).toContain(TEST_GROUP.id);
      expect(read.ids.every((id) => windowIds.includes(id))).toBe(true);
      expect(read.ids).not.toContain(far);
    }
    const last = reads[reads.length - 1]?.ids ?? [];
    expect(last).toEqual(expect.arrayContaining(inside.map((d) => d.id)));
    // Every shown note's preview is up.
    for (const note of inside) expect(shows(note.text), note.text).toBe(true);
  });
});
