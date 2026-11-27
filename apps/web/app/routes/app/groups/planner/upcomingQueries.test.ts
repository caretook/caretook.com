import { describe, expect, it } from "vitest";
import { pastEventsWindow, upcomingWindow } from "../../../../lib/timeline/timeline.sync";
import {
  inUpcomingHorizon,
  pastQueries,
  pastTextCondition,
  pastTextQuery,
  upcomingQueries,
  windowStart,
} from "./upcomingQueries";

const GROUP = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";
const AUTHOR = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c00a1";

describe("windowStart", () => {
  it("rounds down to the UTC day, so the query changes once a day", () => {
    expect(windowStart(new Date("2026-11-18T23:59:59.999Z")).toISOString()).toBe("2026-11-18T00:00:00.000Z");
    expect(windowStart(Date.parse("2026-11-19T00:00:00.000Z")).toISOString()).toBe(
      "2026-11-19T00:00:00.000Z",
    );
  });
});

describe("upcomingQueries", () => {
  const filters = { kind: "event" as const, author: AUTHOR };
  const key = (now: string) => JSON.stringify(upcomingQueries(GROUP, filters, new Date(now)));

  it("reads upcomingWindow from the day, a day further out, and the links for the same window", () => {
    const window = upcomingWindow(GROUP, filters, new Date("2026-11-18T00:00:00.000Z"), 91);
    const queries = upcomingQueries(GROUP, filters, new Date("2026-11-18T18:00:42.000Z"));
    expect(queries.entries).toEqual({ sql: `SELECT * ${window.sql}`, params: window.params });
    expect(queries.contacts.sql).toContain(`IN (SELECT id ${window.sql})`);
    expect(queries.contacts.params).toEqual(window.params);
  });

  it("stays the same query as the clock ticks, so a tick reruns nothing (B-910)", () => {
    const at = key("2026-11-18T18:00:42.000Z");
    expect(key("2026-11-18T18:01:12.000Z")).toBe(at);
    expect(key("2026-11-18T19:30:00.000Z")).toBe(at);
    expect(key("2026-11-19T00:00:00.000Z")).not.toBe(at);
  });

  it("keeps the horizon at now's: what starts 90 days on is left out", () => {
    const now = new Date("2026-11-18T18:00:42.000Z");
    const at = (ms: number) => ({ occurredAt: new Date(now.getTime() + ms).toISOString() });
    expect(inUpcomingHorizon(at(90 * 86_400_000 - 1), now)).toBe(true);
    expect(inUpcomingHorizon(at(90 * 86_400_000), now)).toBe(false);
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

describe("the Past tab's text filter", () => {
  const cutoff = "2026-11-18T18:01:00.000Z";
  it("reads every past event under the other filters, uncapped, with its title and place", () => {
    const match = { sql: "0", params: [] };
    const query = pastTextQuery(GROUP, { kind: null, author: AUTHOR, match }, cutoff);
    expect(query.sql).toMatch(/^SELECT id, title, place FROM timeline_entry WHERE /);
    expect(query.sql).not.toContain("LIMIT");
    expect(query.sql).not.toContain("(0)");
    expect(query.params).toContain(AUTHOR);
  });

  it("matches title, place or document text, case and accents ignored; none without text", () => {
    const rows = [
      { id: "a", title: "Cardiología", place: null },
      { id: "b", title: "Dentist", place: "Main St clinic" },
      { id: "c", title: "Eye doctor", place: null },
    ];
    const previews = new Map([["c", "Bring the old glasses"]]);
    const ids = (q: string) =>
      JSON.parse(String(pastTextCondition(rows, previews, q)?.params[0])) as string[];
    expect(pastTextCondition(rows, previews, "  ")).toBeNull();
    expect(ids("CARDIOLOGIA")).toEqual(["a"]);
    expect(ids("clinic")).toEqual(["b"]);
    expect(ids("glasses")).toEqual(["c"]);
    expect(ids("nothing")).toEqual([]);
  });
});
