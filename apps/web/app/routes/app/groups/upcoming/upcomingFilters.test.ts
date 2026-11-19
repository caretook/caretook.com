import { describe, expect, it } from "vitest";
import {
  emptyPastText,
  emptyUpcomingText,
  parsePastFilters,
  parseUpcomingFilters,
  tabSearch,
} from "./upcomingFilters";

const A = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c00a1";

describe("parseUpcomingFilters", () => {
  it("reads the timeline's kind and author", () => {
    expect(parseUpcomingFilters(`?kind=event&author=${A}`)).toEqual({ kind: "event", author: A });
    expect(parseUpcomingFilters("?kind=note")).toEqual({ kind: "note", author: null });
    expect(parseUpcomingFilters("")).toEqual({ kind: null, author: null });
  });

  it("reads a kind Upcoming doesn't list as no kind", () => {
    expect(parseUpcomingFilters(`?kind=vital&author=${A}`)).toEqual({ kind: null, author: A });
    expect(parseUpcomingFilters("?kind=nonsense")).toEqual({ kind: null, author: null });
  });
});

describe("parsePastFilters", () => {
  it("keeps only the author (the Past tab lists events)", () => {
    expect(parsePastFilters(`?kind=note&author=${A}`)).toEqual({ kind: null, author: A });
  });
});

describe("tabSearch", () => {
  it("carries kind and author to Upcoming, and only the author to Past", () => {
    expect(tabSearch(`?kind=event&author=${A}&q=x`, "upcoming")).toEqual({ kind: "event", author: A });
    expect(tabSearch(`?kind=event&author=${A}`, "past")).toEqual({ kind: null, author: A });
    expect(tabSearch("?kind=vital", "upcoming")).toEqual({ kind: null, author: null });
  });
});

describe("empty states", () => {
  it("names the filters that are on", () => {
    expect(emptyUpcomingText(null)).toBe("No upcoming appointments or reminders.");
    expect(emptyUpcomingText("event")).toBe("No upcoming appointments.");
    expect(emptyUpcomingText("note", "Alex Rivera")).toBe("No upcoming reminders by Alex Rivera.");
    expect(emptyPastText()).toBe("No past events yet.");
    expect(emptyPastText("Alex Rivera")).toBe("No past events by Alex Rivera.");
  });
});
