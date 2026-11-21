import { describe, expect, it } from "vitest";
import { timelineMedicationsQuery } from "../medications/medicationTimeline.sync";
import { timelineLinksQuery } from "../providers/providers.sync";
import { entryWindow, historyWindow, pastEventsWindow, upcomingWindow } from "./timeline.sync";

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
        `AND kind IN ('note', 'symptom', 'event', 'vital', 'dose', 'medicationChange', 'conditionChange') ${ENDS} ${TAIL}`,
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

describe("the search (EntryFilters.match)", () => {
  const match = { sql: "timeline_entry.id IN (SELECT x)", params: ["walk*", GROUP] };

  it("is ANDed into the history after the other filters, before the cutoff", () => {
    const window = historyWindow(GROUP, { kind: "note", author: AUTHOR, match }, 30, CUTOFF);
    expect(one(window.sql)).toContain(
      "AND kind = ? AND created_by = ? AND (timeline_entry.id IN (SELECT x)) AND (NOT kind IN",
    );
    expect(window.params).toEqual([GROUP, "note", AUTHOR, "walk*", GROUP, local(CUTOFF), 31]);
  });

  it("is ANDed into upcoming and past events", () => {
    const upcoming = upcomingWindow(GROUP, { ...NONE, match }, NOW);
    expect(one(upcoming.sql)).toContain("AND kind IN (?, ?) AND (timeline_entry.id IN (SELECT x)) AND");
    expect(upcoming.params.slice(0, 5)).toEqual([GROUP, "note", "event", "walk*", GROUP]);
    const past = pastEventsWindow(GROUP, { ...NONE, match }, 20, CUTOFF);
    expect(past.params).toEqual([GROUP, "event", "walk*", GROUP, local(CUTOFF), 21]);
  });

  it("no match is no condition", () => {
    expect(historyWindow(GROUP, { ...NONE, match: null }, 30, CUTOFF)).toEqual(
      historyWindow(GROUP, NONE, 30, CUTOFF),
    );
  });
});

describe("the vital type (EntryFilters.vital)", () => {
  const TYPE =
    "EXISTS (SELECT 1 FROM json_each(details, '$.readings') r WHERE json_extract(r.value, '$.type') = ?)";

  it("keeps only entries with a reading of that type, after the kind and author", () => {
    const window = historyWindow(
      GROUP,
      { kind: "vital", author: AUTHOR, vital: "bloodPressure" },
      30,
      CUTOFF,
    );
    expect(one(window.sql)).toContain(`AND kind = ? AND created_by = ? AND ${TYPE} AND (NOT kind`);
    expect(window.params).toEqual([GROUP, "vital", AUTHOR, "bloodPressure", local(CUTOFF), 31]);
  });

  it("is in the shared window (entryWindow), so the links and medications follow it", () => {
    const window = entryWindow(GROUP, { kind: "vital", author: null, vital: "weight" }, 30);
    expect(one(window.sql)).toBe(
      `FROM timeline_entry WHERE group_id = ? AND deleted_at IS NULL AND kind = ? AND ${TYPE} ` +
        "ORDER BY occurred_at DESC, id DESC LIMIT ?",
    );
    expect(window.params).toEqual([GROUP, "vital", "weight", 31]);
    expect(
      one(timelineLinksQuery(GROUP, { kind: "vital", author: null, vital: "weight" }, 30, CUTOFF).sql),
    ).toContain(TYPE);
    expect(
      one(timelineMedicationsQuery(GROUP, { kind: "vital", author: null, vital: "weight" }, 30, CUTOFF).sql),
    ).toContain(TYPE);
  });

  it("no type is no condition", () => {
    expect(historyWindow(GROUP, { ...NONE, vital: null }, 30, CUTOFF)).toEqual(
      historyWindow(GROUP, NONE, 30, CUTOFF),
    );
  });
});
