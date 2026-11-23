import { describe, expect, it } from "vitest";
import {
  emptyPastText,
  emptyUpcomingText,
  parsePastFilters,
  parseUpcomingFilters,
  setShow,
  tabSearch,
} from "./upcomingFilters";

const A = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c00a1";

describe("parseUpcomingFilters", () => {
  it("reads events only (?kind=event), todos only (?show=todos) and the author", () => {
    expect(parseUpcomingFilters(`?kind=event&author=${A}`)).toEqual({
      kind: "event",
      author: A,
      show: "event",
      todosOnly: false,
    });
    expect(parseUpcomingFilters(`?show=todos&author=${A}`)).toEqual({
      kind: null,
      author: A,
      show: "todos",
      todosOnly: true,
    });
    expect(parseUpcomingFilters("")).toEqual({ kind: null, author: null, show: "all", todosOnly: false });
  });

  it("reads a kind Upcoming doesn't list as All", () => {
    for (const search of ["?kind=vital", "?kind=note", "?kind=nonsense", "?show=nonsense"])
      expect(parseUpcomingFilters(search)).toMatchObject({ kind: null, show: "all", todosOnly: false });
    expect(parseUpcomingFilters(`?kind=vital&author=${A}`).author).toBe(A);
  });

  it("lets todos only win over events when both are written", () => {
    expect(parseUpcomingFilters("?kind=event&show=todos")).toMatchObject({ kind: null, show: "todos" });
  });
});

describe("parsePastFilters", () => {
  it("keeps only the author (Past lists events)", () => {
    expect(parsePastFilters(`?kind=note&show=todos&author=${A}`)).toEqual({ kind: null, author: A });
  });
});

describe("setShow", () => {
  it("sets one choice, drops the other's parameter and keeps the rest", () => {
    expect(setShow(`?author=${A}`, "event")).toBe(`?kind=event&author=${A}`);
    expect(setShow(`?kind=event&author=${A}`, "todos")).toBe(`?show=todos&author=${A}`);
    expect(setShow(`?show=todos&x=1`, "event")).toBe("?kind=event&x=1");
    expect(setShow(`?show=todos&author=${A}`, "all")).toBe(`?author=${A}`);
    expect(setShow("?kind=event", "all")).toBe("");
  });
});

describe("tabSearch", () => {
  it("carries what Upcoming shows and the author to the Planner tab, and only the author to Past", () => {
    expect(tabSearch(`?kind=event&author=${A}&q=x`, "planner")).toEqual({
      kind: "event",
      show: null,
      author: A,
    });
    expect(tabSearch(`?show=todos&author=${A}`, "planner")).toEqual({ kind: null, show: "todos", author: A });
    expect(tabSearch(`?kind=event&show=todos&author=${A}`, "past")).toEqual({
      kind: null,
      show: null,
      author: A,
    });
    expect(tabSearch("?kind=vital", "planner")).toEqual({ kind: null, show: null, author: null });
  });
});

describe("empty states", () => {
  it("names what is on", () => {
    expect(emptyUpcomingText("all")).toBe("No upcoming events or todos.");
    expect(emptyUpcomingText("event")).toBe("No upcoming events.");
    expect(emptyUpcomingText("todos", "Alex Rivera")).toBe("No upcoming todos by Alex Rivera.");
    expect(emptyPastText()).toBe("No past events yet.");
    expect(emptyPastText("Alex Rivera")).toBe("No past events by Alex Rivera.");
  });
});
