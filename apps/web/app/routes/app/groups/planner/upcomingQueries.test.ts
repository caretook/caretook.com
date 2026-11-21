import { describe, expect, it } from "vitest";
import { pastEventsWindow, upcomingWindow } from "../../../../lib/timeline/timeline.sync";
import { pastQueries, upcomingQueries, windowStart } from "./upcomingQueries";

const GROUP = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";
const AUTHOR = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c00a1";

describe("windowStart", () => {
  it("rounds down to the minute, so the query changes once a minute", () => {
    expect(windowStart(new Date("2026-11-18T18:00:59.999Z")).toISOString()).toBe("2026-11-18T18:00:00.000Z");
    expect(windowStart(Date.parse("2026-11-18T18:01:00.000Z")).toISOString()).toBe(
      "2026-11-18T18:01:00.000Z",
    );
  });
});

describe("upcomingQueries", () => {
  it("reads upcomingWindow from the minute, and the links for the same window", () => {
    const filters = { kind: "event" as const, author: AUTHOR };
    const window = upcomingWindow(GROUP, filters, new Date("2026-11-18T18:00:00.000Z"));
    const queries = upcomingQueries(GROUP, filters, new Date("2026-11-18T18:00:42.000Z"));
    expect(queries.entries).toEqual({ sql: `SELECT * ${window.sql}`, params: window.params });
    expect(queries.contacts.sql).toContain(`IN (SELECT id ${window.sql})`);
    expect(queries.contacts.params).toEqual(window.params);
  });
});

describe("pastQueries", () => {
  it("reads pastEventsWindow, and the links for the same window", () => {
    const filters = { kind: null, author: AUTHOR };
    const cutoff = "2026-11-18T18:01:00.000Z";
    const window = pastEventsWindow(GROUP, filters, 30, cutoff);
    const queries = pastQueries(GROUP, filters, 30, cutoff);
    expect(queries.entries).toEqual({ sql: `SELECT * ${window.sql}`, params: window.params });
    expect(queries.contacts.params).toEqual(window.params);
  });
});
