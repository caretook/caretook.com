import { describe, expect, it } from "vitest";
import {
  emptyPastText,
  emptyUpcomingText,
  onlyQueryChanged,
  parsePastFilters,
  parseUpcomingFilters,
  pastTagChip,
  setShow,
  tabSearch,
  upcomingFilterSections,
} from "./upcomingFilters";

const A = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c00a1";
const T = "6f1c1d1e-0000-4000-8000-000000000001";
const URGENT = { id: T, name: "Urgent" };

describe("parseUpcomingFilters", () => {
  it("reads events only (?kind=event), todos only (?show=todos) and the author", () => {
    expect(parseUpcomingFilters(`?kind=event&author=${A}`)).toEqual({
      kind: "event",
      author: A,
      show: "event",
      todosOnly: false,
      tag: null,
    });
    expect(parseUpcomingFilters(`?show=todos&author=${A}`)).toEqual({
      kind: null,
      author: A,
      show: "todos",
      todosOnly: true,
      tag: null,
    });
    expect(parseUpcomingFilters("")).toEqual({
      kind: null,
      author: null,
      show: "all",
      todosOnly: false,
      tag: null,
    });
    expect(parseUpcomingFilters(`?tag=${T}`).tag).toBe(T);
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
    expect(parsePastFilters(`?kind=note&show=todos&author=${A}`)).toEqual({
      kind: null,
      author: A,
      tag: null,
    });
    expect(parsePastFilters(`?tag=${T}`).tag).toBe(T);
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
      tag: null,
    });
    expect(tabSearch(`?show=todos&author=${A}`, "planner")).toEqual({
      kind: null,
      show: "todos",
      author: A,
      tag: null,
    });
    expect(tabSearch(`?kind=event&show=todos&author=${A}`, "past")).toEqual({
      kind: null,
      show: null,
      author: A,
      tag: null,
    });
    expect(tabSearch("?kind=vital", "planner")).toEqual({ kind: null, show: null, author: null, tag: null });
    // The tag goes to both tabs.
    expect(tabSearch(`?tag=${T}`, "planner").tag).toBe(T);
    expect(tabSearch(`?show=todos&tag=${T}`, "past")).toMatchObject({ show: null, tag: T });
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

  it("names the search box's text", () => {
    expect(emptyUpcomingText("all", null, " eye ")).toBe("No upcoming events or todos matching “eye”.");
    expect(emptyUpcomingText("event", "Alex Rivera", "eye")).toBe(
      "No upcoming events by Alex Rivera matching “eye”.",
    );
    expect(emptyPastText(null, "eye")).toBe("No past events matching “eye”.");
    expect(emptyPastText("Alex Rivera", "eye")).toBe("No past events by Alex Rivera matching “eye”.");
  });
});

describe("onlyQueryChanged", () => {
  const url = (path: string) => new URL(path, "https://caretook.test");
  it("is true when only ?q= changed on the same path", () => {
    expect(onlyQueryChanged(url("/p?author=a"), url("/p?author=a&q=eye"))).toBe(true);
    expect(onlyQueryChanged(url("/p?q=ey"), url("/p?q=eye"))).toBe(true);
    expect(onlyQueryChanged(url("/p?q=eye"), url("/p?author=a&q=eye"))).toBe(false);
    expect(onlyQueryChanged(url("/p?q=eye"), url("/p/past?q=eye"))).toBe(false);
  });
});

describe("the Planner's filter options (tags)", () => {
  it("Upcoming has Show alone without tags, and Show then Tag with them", () => {
    expect(upcomingFilterSections("", "all", []).map((s) => s.id)).toEqual(["show"]);
    const sections = upcomingFilterSections(`?kind=event&tag=${T}`, "event", [URGENT]);
    expect(sections.map((s) => [s.id, s.current])).toEqual([
      ["show", "event"],
      ["tag", T],
    ]);
    expect(sections[1]!.options.map((o) => [o.label, o.search])).toEqual([
      ["Any", "?kind=event"],
      ["Urgent", `?kind=event&tag=${T}`],
    ]);
    // Show's choices keep the tag.
    expect(sections[0]!.options.find((o) => o.id === "todos")?.search).toBe(`?show=todos&tag=${T}`);
  });

  it("Past carries the tag as a chip, and none without one", () => {
    expect(pastTagChip(`?author=${A}&tag=${T}`, URGENT)).toEqual([
      { id: "tag", label: "Urgent", name: "Urgent: clear this filter", search: `?author=${A}` },
    ]);
    expect(pastTagChip("", null)).toEqual([]);
  });

  it("empty states name the tag", () => {
    expect(emptyUpcomingText("all", null, "", "Urgent")).toBe("No upcoming events or todos tagged “Urgent”.");
    expect(emptyPastText(null, "", "Urgent")).toBe("No past events tagged “Urgent”.");
  });
});
