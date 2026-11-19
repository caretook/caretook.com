import { describe, expect, it } from "vitest";
import {
  clearAuthor,
  clearFilters,
  clearKind,
  clearUpcoming,
  hasFilters,
  parseFilters,
  setAuthor,
  setKind,
  setUpcoming,
} from "./timelineFilters";

const ALEX = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const SAM = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0aaa";

describe("parseFilters", () => {
  it("reads no filters from an empty search", () => {
    expect(parseFilters("")).toEqual({ kind: null, author: null, upcoming: false });
    expect(parseFilters("?")).toEqual({ kind: null, author: null, upcoming: false });
  });

  it("reads a kind, an author, or both", () => {
    expect(parseFilters("?kind=symptom")).toEqual({ kind: "symptom", author: null, upcoming: false });
    expect(parseFilters(`?author=${ALEX}`)).toEqual({ kind: null, author: ALEX, upcoming: false });
    expect(parseFilters(`?kind=vital&author=${ALEX}`)).toEqual({
      kind: "vital",
      author: ALEX,
      upcoming: false,
    });
    expect(parseFilters(`?author=${ALEX}&kind=note`)).toEqual({
      kind: "note",
      author: ALEX,
      upcoming: false,
    });
  });

  it("reads a search without its question mark", () => {
    expect(parseFilters("kind=event")).toEqual({ kind: "event", author: null, upcoming: false });
  });

  it("knows every kind", () => {
    for (const kind of ["note", "symptom", "event", "vital", "dose", "medicationChange"]) {
      expect(parseFilters(`?kind=${kind}`).kind).toBe(kind);
    }
  });

  it("ignores an unknown kind", () => {
    expect(parseFilters("?kind=medication")).toEqual({ kind: null, author: null, upcoming: false });
    expect(parseFilters("?kind=")).toEqual({ kind: null, author: null, upcoming: false });
    expect(parseFilters("?kind=Symptom")).toEqual({ kind: null, author: null, upcoming: false });
  });

  it("ignores an author that isn't a user id", () => {
    expect(parseFilters("?author=alex")).toEqual({ kind: null, author: null, upcoming: false });
    expect(parseFilters("?author=")).toEqual({ kind: null, author: null, upcoming: false });
    expect(parseFilters(`?author=${ALEX}'%20OR%201=1`)).toEqual({
      kind: null,
      author: null,
      upcoming: false,
    });
  });

  it("keeps the valid filter when the other is unknown", () => {
    expect(parseFilters(`?kind=nope&author=${ALEX}`)).toEqual({ kind: null, author: ALEX, upcoming: false });
    expect(parseFilters("?kind=note&author=nope")).toEqual({ kind: "note", author: null, upcoming: false });
  });

  it("reads an author id in lower case", () => {
    expect(parseFilters(`?author=${ALEX.toUpperCase()}`).author).toBe(ALEX);
  });

  it("ignores other parameters", () => {
    expect(parseFilters("?q=fall&kind=event")).toEqual({ kind: "event", author: null, upcoming: false });
  });
});

describe("hasFilters", () => {
  it("is true when either filter is on", () => {
    expect(hasFilters(parseFilters(""))).toBe(false);
    expect(hasFilters(parseFilters("?kind=bogus"))).toBe(false);
    expect(hasFilters(parseFilters("?kind=note"))).toBe(true);
    expect(hasFilters(parseFilters(`?author=${ALEX}`))).toBe(true);
  });
});

describe("setKind", () => {
  it("sets the kind", () => {
    expect(setKind("", "symptom")).toBe("?kind=symptom");
  });

  it("replaces another kind", () => {
    expect(setKind("?kind=note", "symptom")).toBe("?kind=symptom");
  });

  it("keeps the author", () => {
    expect(setKind(`?author=${ALEX}`, "symptom")).toBe(`?kind=symptom&author=${ALEX}`);
    expect(setKind(`?kind=note&author=${ALEX}`, "vital")).toBe(`?kind=vital&author=${ALEX}`);
  });

  it("returns the same search when the kind is already on", () => {
    expect(setKind("?kind=symptom", "symptom")).toBe("?kind=symptom");
    const both = `?author=${ALEX}&kind=symptom`;
    expect(setKind(both, "symptom")).toBe(both);
  });

  it("replaces an unknown kind, and drops an unknown author", () => {
    expect(setKind("?kind=bogus&author=nope", "event")).toBe("?kind=event");
  });

  it("changes nothing for a kind it doesn't know", () => {
    expect(setKind("?kind=note", "medication" as never)).toBe("?kind=note");
  });
});

describe("setAuthor", () => {
  it("sets the author", () => {
    expect(setAuthor("", ALEX)).toBe(`?author=${ALEX}`);
  });

  it("replaces another author", () => {
    expect(setAuthor(`?author=${SAM}`, ALEX)).toBe(`?author=${ALEX}`);
  });

  it("keeps the kind", () => {
    expect(setAuthor("?kind=symptom", ALEX)).toBe(`?kind=symptom&author=${ALEX}`);
    expect(setAuthor(`?kind=symptom&author=${SAM}`, ALEX)).toBe(`?kind=symptom&author=${ALEX}`);
  });

  it("returns the same search when the author is already on", () => {
    const both = `?kind=symptom&author=${ALEX}`;
    expect(setAuthor(both, ALEX)).toBe(both);
    expect(setAuthor(`?author=${ALEX}`, ALEX.toUpperCase())).toBe(`?author=${ALEX}`);
  });

  it("changes nothing for an id that isn't a user id", () => {
    expect(setAuthor("?kind=note", "alex")).toBe("?kind=note");
    expect(setAuthor("", "")).toBe("");
  });
});

describe("clearKind", () => {
  it("clears the kind and keeps the author", () => {
    expect(clearKind("?kind=symptom")).toBe("");
    expect(clearKind(`?kind=symptom&author=${ALEX}`)).toBe(`?author=${ALEX}`);
  });

  it("returns the same search when no kind is on", () => {
    expect(clearKind("")).toBe("");
    expect(clearKind(`?author=${ALEX}`)).toBe(`?author=${ALEX}`);
  });
});

describe("clearAuthor", () => {
  it("clears the author and keeps the kind", () => {
    expect(clearAuthor(`?author=${ALEX}`)).toBe("");
    expect(clearAuthor(`?kind=symptom&author=${ALEX}`)).toBe("?kind=symptom");
  });

  it("returns the same search when no author is on", () => {
    expect(clearAuthor("")).toBe("");
    expect(clearAuthor("?kind=symptom")).toBe("?kind=symptom");
  });
});

describe("clearFilters", () => {
  it("clears both filters", () => {
    expect(clearFilters(`?kind=symptom&author=${ALEX}`)).toBe("");
    expect(clearFilters("?kind=symptom")).toBe("");
    expect(clearFilters(`?author=${ALEX}`)).toBe("");
  });

  it("returns the same search when nothing is on", () => {
    expect(clearFilters("")).toBe("");
  });
});

describe("other parameters", () => {
  it("are kept through every change", () => {
    expect(setKind("?q=fall", "event")).toBe("?kind=event&q=fall");
    expect(setAuthor("?q=fall&kind=event", ALEX)).toBe(`?kind=event&author=${ALEX}&q=fall`);
    expect(clearKind("?kind=event&q=fall")).toBe("?q=fall");
    expect(clearAuthor(`?author=${ALEX}&q=fall`)).toBe("?q=fall");
    expect(clearFilters(`?kind=event&author=${ALEX}&q=fall`)).toBe("?q=fall");
  });
});

describe("a round trip", () => {
  it("reads back what each change wrote", () => {
    let search = "";
    search = setKind(search, "symptom");
    search = setAuthor(search, ALEX);
    expect(parseFilters(search)).toEqual({ kind: "symptom", author: ALEX, upcoming: false });
    search = clearKind(search);
    expect(parseFilters(search)).toEqual({ kind: null, author: ALEX, upcoming: false });
    search = setKind(search, "note");
    search = clearAuthor(search);
    expect(parseFilters(search)).toEqual({ kind: "note", author: null, upcoming: false });
  });
});

describe("the Upcoming block (?upcoming=1)", () => {
  it("reads only 1 as on", () => {
    expect(parseFilters("?upcoming=1").upcoming).toBe(true);
    expect(parseFilters("?upcoming=0").upcoming).toBe(false);
    expect(parseFilters("?upcoming=true").upcoming).toBe(false);
    expect(parseFilters(`?kind=event&author=${ALEX}&upcoming=1`)).toEqual({
      kind: "event",
      author: ALEX,
      upcoming: true,
    });
  });

  it("is not a filter", () => {
    expect(hasFilters(parseFilters("?upcoming=1"))).toBe(false);
  });

  it("turns on after the filters, and off again, keeping them", () => {
    expect(setUpcoming("")).toBe("?upcoming=1");
    expect(setUpcoming(`?author=${ALEX}&kind=event`)).toBe(`?kind=event&author=${ALEX}&upcoming=1`);
    expect(clearUpcoming(`?kind=event&upcoming=1`)).toBe("?kind=event");
    expect(clearUpcoming("?upcoming=1")).toBe("");
  });

  it("returns the same search when it changes nothing", () => {
    expect(setUpcoming("?upcoming=1&q=x")).toBe("?upcoming=1&q=x");
    expect(clearUpcoming("?kind=note")).toBe("?kind=note");
  });

  it("stays through every filter change", () => {
    expect(setKind("?upcoming=1", "note")).toBe("?kind=note&upcoming=1");
    expect(setAuthor("?upcoming=1", ALEX)).toBe(`?author=${ALEX}&upcoming=1`);
    expect(clearKind("?kind=note&upcoming=1")).toBe("?upcoming=1");
    expect(clearAuthor(`?author=${ALEX}&upcoming=1`)).toBe("?upcoming=1");
    expect(clearFilters(`?kind=note&author=${ALEX}&upcoming=1`)).toBe("?upcoming=1");
  });
});
