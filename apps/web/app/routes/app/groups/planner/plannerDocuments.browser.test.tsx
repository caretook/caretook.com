import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { fx } from "../../../../../test/fixtures";
import { fixClock, waitUntil } from "../../../../../test/found";
import { PREVIEWS_SQL, recordReads } from "../../../../../test/reads";
import { laTime, listed, NOW, openPlanner, PAST_NOTE, PAST_URL } from "./plannerWorld";

// Upcoming and Past read only their own entries' documents (B-313): never
// the group's notes, nor the other tab's events. Their text still matches
// the search box.

const SOON = fx.event({
  title: "Audiology visit",
  occurredAt: laTime(1, 15),
  text: "Bring the old hearing aids.",
});
const GONE_BY = fx.event({ title: "Vision check", occurredAt: laTime(-2, 11), text: "New lenses ordered." });
const PAST_NOTE_2 = fx.note({ occurredAt: laTime(-1, 12), text: "Asked about the garden." });
const extra = [SOON, GONE_BY, PAST_NOTE_2];

const search = async (text: string) => {
  await userEvent.clear(page.getByRole("searchbox"));
  await userEvent.type(page.getByRole("searchbox"), text);
};

beforeEach(() => fixClock(NOW));
afterEach(() => {
  vi.useRealTimers();
});

describe("the Planner's note previews", () => {
  test("Upcoming: only its events' documents; their text is still searched", async () => {
    const reads = recordReads(PREVIEWS_SQL);
    await openPlanner({ extra });
    await waitUntil(() => listed().some((r) => r.id === SOON.id), "the Planner");
    expect(reads.length).toBeGreaterThanOrEqual(2);
    for (const read of reads) {
      expect(read.ids).toContain(SOON.id);
      for (const id of [GONE_BY.id, PAST_NOTE_2.id, PAST_NOTE.id]) expect(read.ids).not.toContain(id);
    }

    await search("hearing aids");
    await waitUntil(() => listed().length === 1 && listed()[0]!.id === SOON.id, "the match by its text");
  });

  test("Past: only past events' documents; their text is still searched", async () => {
    const reads = recordReads(PREVIEWS_SQL);
    await openPlanner({ url: PAST_URL, extra });
    await waitUntil(() => listed().some((r) => r.id === GONE_BY.id), "the Past tab");
    expect(reads.length).toBeGreaterThanOrEqual(2);
    for (const read of reads) {
      expect(read.ids).toContain(GONE_BY.id);
      for (const id of [SOON.id, PAST_NOTE_2.id, PAST_NOTE.id]) expect(read.ids).not.toContain(id);
    }

    await search("lenses");
    await waitUntil(() => listed().length === 1 && listed()[0]!.id === GONE_BY.id, "the match by its text");
  });
});
