import { describe, expect, it } from "vitest";
import { historyWindow, pastEventsWindow, upcomingWindow } from "./timeline";

// The history, upcoming and past-events windows: their conditions and
// parameters, with and without the kind and author filters.

const GROUP = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";
const AUTHOR = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c00a1";
const one = (sql: string) => sql.replace(/\s+/g, " ").trim();
const NONE = { kind: null, author: null };

const NOW = new Date("2026-11-18T18:00:00.000Z");
const CUTOFF = "2026-11-18T18:01:00.000Z";
const local = (iso: string) => iso.replace(/Z$/, "000Z");

describe("the history (historyWindow)", () => {
  const TAIL = "ORDER BY occurred_at DESC, id DESC LIMIT ?";
  const ENDS = "AND (NOT kind IN ('note', 'event') OR occurred_at <= ?)";

  it("ends notes and events at the cutoff; other kinds always count", () => {
    const window = historyWindow(GROUP, NONE, 30, CUTOFF);
    expect(one(window.sql)).toBe(
      "FROM timeline_entry WHERE group_id = ? AND deleted_at IS NULL " +
        `AND kind IN ('note', 'symptom', 'event', 'vital') ${ENDS} ${TAIL}`,
    );
    expect(window.params).toEqual([GROUP, local(CUTOFF), 31]);
  });

  it("keeps the kind and author filters", () => {
    const window = historyWindow(GROUP, { kind: "event", author: AUTHOR }, 30, CUTOFF);
    expect(one(window.sql)).toBe(
      `FROM timeline_entry WHERE group_id = ? AND deleted_at IS NULL AND kind = ? AND created_by = ? ${ENDS} ${TAIL}`,
    );
    expect(window.params).toEqual([GROUP, "event", AUTHOR, local(CUTOFF), 31]);
  });
});

describe("upcoming (upcomingWindow)", () => {
  const TIMING =
    "AND (occurred_at > ? OR ends_at > ? OR (all_day = 1 AND occurred_at > ?)) AND occurred_at < ? " +
    "ORDER BY occurred_at ASC, id ASC";
  const nowText = local(NOW.toISOString());
  const dayBack = "2026-11-17T17:00:00.000000Z"; // 25 hours before now: the longest day
  const horizon = "2027-02-16T18:00:00.000000Z"; // 90 days on

  it("notes and events after now, ending after now, or all day today, within 90 days, soonest first", () => {
    const window = upcomingWindow(GROUP, NONE, NOW);
    expect(one(window.sql)).toBe(
      `FROM timeline_entry WHERE group_id = ? AND deleted_at IS NULL AND kind IN (?, ?) ${TIMING}`,
    );
    expect(window.params).toEqual([GROUP, "note", "event", nowText, nowText, dayBack, horizon]);
  });

  it("keeps the kind and author filters (a symptom filter finds nothing)", () => {
    const window = upcomingWindow(GROUP, { kind: "symptom", author: AUTHOR }, NOW, 7);
    expect(one(window.sql)).toBe(
      "FROM timeline_entry WHERE group_id = ? AND deleted_at IS NULL AND kind = ? AND kind IN (?, ?) " +
        `AND created_by = ? ${TIMING}`,
    );
    expect(window.params).toEqual([
      GROUP,
      "symptom",
      "note",
      "event",
      AUTHOR,
      nowText,
      nowText,
      dayBack,
      "2026-11-25T18:00:00.000000Z",
    ]);
  });
});

describe("past events (pastEventsWindow)", () => {
  const TAIL = "AND occurred_at <= ? ORDER BY occurred_at DESC, id DESC LIMIT ?";

  it("events that have started, cancelled ones included, newest first", () => {
    const window = pastEventsWindow(GROUP, NONE, 20, CUTOFF);
    expect(one(window.sql)).toBe(
      `FROM timeline_entry WHERE group_id = ? AND deleted_at IS NULL AND kind IN (?) ${TAIL}`,
    );
    expect(window.params).toEqual([GROUP, "event", local(CUTOFF), 21]);
  });

  it("keeps the author filter", () => {
    const window = pastEventsWindow(GROUP, { kind: null, author: AUTHOR }, 20, CUTOFF);
    expect(window.params).toEqual([GROUP, "event", AUTHOR, local(CUTOFF), 21]);
  });
});
