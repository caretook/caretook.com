import { describe, expect, it } from "vitest";
import { nextNewerWindow } from "./timelineNewer";

const LA = "America/Los_Angeles";
const PAGE = 4;
/** `count` rows on a day (PST), an hour apart from 08:00, optionally in a pass log. */
const on = (day: string, count: number, log: string | null = null) =>
  Array.from({ length: count }, (_, i) => ({
    at: `${day}T${String(16 + i).padStart(2, "0")}:00:00.000Z`,
    log,
  }));
const next = (rows: ReturnType<typeof on>, asked = 100) =>
  nextNewerWindow(rows, { asked, timeZone: LA, pageSize: PAGE });

describe("the next bound when paging newer (nextNewerWindow)", () => {
  it("mid-history: the end of the day holding the page's last row", () => {
    const rows = [...on("2026-01-05", 3), ...on("2026-01-06", 2), ...on("2026-01-07", 4)];
    expect(next(rows)).toEqual({ before: "2026-01-07T08:00:00.000Z", added: 5 });
  });

  it("a day larger than a page comes whole", () => {
    const rows = [...on("2026-01-05", 7), ...on("2026-01-06", 4)];
    expect(next(rows)).toEqual({ before: "2026-01-06T08:00:00.000Z", added: 7 });
  });

  it("a pass log across the day's end moves the bound past it", () => {
    const rows = [
      ...on("2026-01-05", 3),
      { at: "2026-01-06T07:30:00.000Z", log: "round" },
      { at: "2026-01-06T08:30:00.000Z", log: "round" },
      ...on("2026-01-07", 4),
    ];
    expect(next(rows)).toEqual({ before: "2026-01-07T08:00:00.000Z", added: 5 });
  });

  it("reaching now: fewer than a page left clears the bound", () => {
    expect(next(on("2026-01-05", 3))).toEqual({ before: null, added: 3 });
    expect(next([])).toEqual({ before: null, added: 0 });
    // A page and a bit: what's left past the day is under a page.
    expect(next([...on("2026-01-05", 4), ...on("2026-01-06", 3)])).toEqual({ before: null, added: 7 });
  });

  it("asks for more when the answer lies past the rows read", () => {
    // Every row read is one day: it may go on.
    expect(next(on("2026-01-05", 6), 6)).toBeNull();
    // The day ends, but a full page past it isn't known yet.
    expect(next([...on("2026-01-05", 4), ...on("2026-01-06", 2)], 6)).toBeNull();
  });

  it("the day's end follows DST", () => {
    const rows = [...on("2026-03-08", 4), ...on("2026-03-09", 4)];
    expect(next(rows)?.before).toBe("2026-03-09T07:00:00.000Z");
  });
});
