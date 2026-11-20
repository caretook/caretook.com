import { describe, expect, it } from "vitest";
import {
  clearAuthor,
  clearFilters,
  clearKind,
  clearQuery,
  clearVital,
  hasFilters,
  normalizeQuery,
  parseFilters,
  setAuthor,
  setKind,
  setQuery,
  setPeriod,
  clearPeriod,
  setVital,
} from "./timelineFilters";

const ALEX = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const SAM = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0aaa";

describe("parseFilters", () => {
  it("reads no filters from an empty search", () => {
    expect(parseFilters("")).toEqual({
      kind: null,
      author: null,
      q: "",
      period: null,
      vital: null,
    });
    expect(parseFilters("?")).toEqual({
      kind: null,
      author: null,
      q: "",
      period: null,
      vital: null,
    });
  });

  it("reads a kind, an author, or both", () => {
    expect(parseFilters("?kind=symptom")).toEqual({
      kind: "symptom",
      author: null,
      q: "",
      period: null,
      vital: null,
    });
    expect(parseFilters(`?author=${ALEX}`)).toEqual({
      kind: null,
      author: ALEX,
      q: "",
      period: null,
      vital: null,
    });
    expect(parseFilters(`?kind=vital&author=${ALEX}`)).toEqual({
      kind: "vital",
      author: ALEX,
      vital: null,
      q: "",
      period: null,
    });
    expect(parseFilters(`?author=${ALEX}&kind=note`)).toEqual({
      kind: "note",
      author: ALEX,
      vital: null,
      q: "",
      period: null,
    });
  });

  it("reads a search without its question mark", () => {
    expect(parseFilters("kind=event")).toEqual({
      kind: "event",
      author: null,
      q: "",
      period: null,
      vital: null,
    });
  });

  it("knows every kind", () => {
    for (const kind of ["note", "symptom", "event", "vital", "dose", "medicationChange"]) {
      expect(parseFilters(`?kind=${kind}`).kind).toBe(kind);
    }
  });

  it("ignores an unknown kind", () => {
    expect(parseFilters("?kind=medication")).toEqual({
      kind: null,
      author: null,
      q: "",
      period: null,
      vital: null,
    });
    expect(parseFilters("?kind=")).toEqual({
      kind: null,
      author: null,
      q: "",
      period: null,
      vital: null,
    });
    expect(parseFilters("?kind=Symptom")).toEqual({
      kind: null,
      author: null,
      q: "",
      period: null,
      vital: null,
    });
  });

  it("ignores an author that isn't a user id", () => {
    expect(parseFilters("?author=alex")).toEqual({
      kind: null,
      author: null,
      q: "",
      period: null,
      vital: null,
    });
    expect(parseFilters("?author=")).toEqual({
      kind: null,
      author: null,
      q: "",
      period: null,
      vital: null,
    });
    expect(parseFilters(`?author=${ALEX}'%20OR%201=1`)).toEqual({
      kind: null,
      author: null,
      vital: null,
      q: "",
      period: null,
    });
  });

  it("keeps the valid filter when the other is unknown", () => {
    expect(parseFilters(`?kind=nope&author=${ALEX}`)).toEqual({
      kind: null,
      author: ALEX,
      vital: null,
      q: "",
      period: null,
    });
    expect(parseFilters("?kind=note&author=nope")).toEqual({
      kind: "note",
      author: null,
      vital: null,
      q: "",
      period: null,
    });
  });

  it("reads an author id in lower case", () => {
    expect(parseFilters(`?author=${ALEX.toUpperCase()}`).author).toBe(ALEX);
  });

  it("ignores other parameters", () => {
    expect(parseFilters("?view=cards&kind=event")).toEqual({
      kind: "event",
      author: null,
      vital: null,
      q: "",
      period: null,
    });
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
    expect(setKind("?x=1", "event")).toBe("?kind=event&x=1");
    expect(setAuthor("?x=1&kind=event", ALEX)).toBe(`?kind=event&author=${ALEX}&x=1`);
    expect(clearKind("?kind=event&x=1")).toBe("?x=1");
    expect(clearAuthor(`?author=${ALEX}&x=1`)).toBe("?x=1");
    expect(clearFilters(`?kind=event&author=${ALEX}&x=1`)).toBe("?x=1");
    expect(setQuery("?x=1", "fall")).toBe("?q=fall&x=1");
    expect(clearQuery("?q=fall&x=1")).toBe("?x=1");
  });
});

describe("a round trip", () => {
  it("reads back what each change wrote", () => {
    let search = "";
    search = setKind(search, "symptom");
    search = setAuthor(search, ALEX);
    expect(parseFilters(search)).toEqual({
      kind: "symptom",
      author: ALEX,
      q: "",
      period: null,
      vital: null,
    });
    search = clearKind(search);
    expect(parseFilters(search)).toEqual({
      kind: null,
      author: ALEX,
      q: "",
      period: null,
      vital: null,
    });
    search = setKind(search, "note");
    search = clearAuthor(search);
    expect(parseFilters(search)).toEqual({
      kind: "note",
      author: null,
      q: "",
      period: null,
      vital: null,
    });
  });
});

describe("an old ?upcoming=1 (the Upcoming block's switch, gone with it)", () => {
  it("is just another parameter: kept, after the filters, and no filter", () => {
    expect(parseFilters("?upcoming=1")).toEqual(parseFilters(""));
    expect(hasFilters(parseFilters("?upcoming=1"))).toBe(false);
    expect(setKind("?upcoming=1", "note")).toBe("?kind=note&upcoming=1");
    expect(clearFilters(`?kind=note&author=${ALEX}&upcoming=1`)).toBe("?upcoming=1");
  });
});

describe("the search (?q=)", () => {
  it("reads the text, trimmed, with runs of spaces as one", () => {
    expect(parseFilters("?q=fall").q).toBe("fall");
    expect(parseFilters("?q=%20%20blood%20%20%20pressure%20").q).toBe("blood pressure");
    expect(parseFilters("?q=").q).toBe("");
    expect(parseFilters("?q=%20%20").q).toBe("");
    expect(parseFilters("").q).toBe("");
  });

  it("keeps quotes and exclusions as typed", () => {
    expect(parseFilters(`?q=${encodeURIComponent('"blood pressure" -pain')}`).q).toBe(
      '"blood pressure" -pain',
    );
  });

  it("caps the text at 200 characters", () => {
    const long = "a".repeat(250);
    expect(parseFilters(`?q=${long}`).q).toHaveLength(200);
    expect(setQuery("", long)).toBe(`?q=${"a".repeat(200)}`);
    expect(normalizeQuery(`${"b".repeat(199)} c`)).toBe("b".repeat(199));
  });

  it("is a filter", () => {
    expect(hasFilters(parseFilters("?q=fall"))).toBe(true);
    expect(hasFilters(parseFilters("?q=%20"))).toBe(false);
  });

  it("sets the search after the kind and author, before other parameters", () => {
    expect(setQuery("", "fall")).toBe("?q=fall");
    expect(setQuery(`?upcoming=1&author=${ALEX}&kind=note`, "fall")).toBe(
      `?kind=note&author=${ALEX}&q=fall&upcoming=1`,
    );
    expect(setQuery("", "blood pressure")).toBe("?q=blood+pressure");
  });

  it("replaces another search, trimmed", () => {
    expect(setQuery("?q=fall", "  walk ")).toBe("?q=walk");
  });

  it("returns the same search when the text is the same once trimmed", () => {
    expect(setQuery("?q=fall", "fall ")).toBe("?q=fall");
    expect(setQuery("", "   ")).toBe("");
    expect(setQuery("?kind=note", "")).toBe("?kind=note");
  });

  it("clears the search with blank text, or clearQuery, keeping the other filters", () => {
    expect(setQuery("?kind=note&q=fall", " ")).toBe("?kind=note");
    expect(clearQuery(`?kind=note&author=${ALEX}&q=fall&upcoming=1`)).toBe(
      `?kind=note&author=${ALEX}&upcoming=1`,
    );
    expect(clearQuery("?kind=note")).toBe("?kind=note");
  });

  it("stays through the kind and author changes", () => {
    expect(setKind("?q=fall", "event")).toBe("?kind=event&q=fall");
    expect(setAuthor("?q=fall&kind=event", ALEX)).toBe(`?kind=event&author=${ALEX}&q=fall`);
    expect(clearKind("?kind=event&q=fall")).toBe("?q=fall");
    expect(clearAuthor(`?author=${ALEX}&q=fall`)).toBe("?q=fall");
  });

  it("goes with clearFilters", () => {
    expect(clearFilters(`?kind=event&author=${ALEX}&q=fall`)).toBe("");
    expect(clearFilters("?q=fall&upcoming=1")).toBe("?upcoming=1");
  });
});

describe("the vital type (?vital=)", () => {
  it("reads a known type only under kind=vital", () => {
    expect(parseFilters("?kind=vital&vital=bloodPressure").vital).toBe("bloodPressure");
    expect(parseFilters("?vital=bloodPressure").vital).toBeNull();
    expect(parseFilters("?kind=symptom&vital=bloodPressure").vital).toBeNull();
    expect(parseFilters("?kind=vital&vital=mood").vital).toBeNull();
    expect(parseFilters("?kind=vital&vital=BloodPressure").vital).toBeNull();
    expect(parseFilters("?kind=vital&vital=").vital).toBeNull();
  });

  it("sets the vital kind with it, keeping the other filters", () => {
    expect(setVital("", "bloodPressure")).toBe("?kind=vital&vital=bloodPressure");
    expect(setVital(`?kind=symptom&author=${ALEX}&q=x`, "weight")).toBe(
      `?kind=vital&author=${ALEX}&q=x&vital=weight`,
    );
    expect(setVital("?kind=vital&vital=weight", "sleep")).toBe("?kind=vital&vital=sleep");
  });

  it("an unknown type changes nothing", () => {
    expect(setVital("?kind=vital", "mood" as never)).toBe("?kind=vital");
  });

  it("returns the same search when it changes nothing", () => {
    expect(setVital("?kind=vital&vital=weight&x=y", "weight")).toBe("?kind=vital&vital=weight&x=y");
    expect(clearVital("?kind=vital")).toBe("?kind=vital");
    expect(setKind("?kind=vital&vital=weight", "vital")).toBe("?kind=vital&vital=weight");
  });

  it("clearVital keeps the vital kind and the other filters", () => {
    expect(clearVital(`?kind=vital&vital=weight&author=${ALEX}`)).toBe(`?kind=vital&author=${ALEX}`);
  });

  it("goes when the kind changes or clears", () => {
    expect(clearKind("?kind=vital&vital=weight")).toBe("");
    expect(setKind("?kind=vital&vital=weight", "symptom")).toBe("?kind=symptom");
    expect(clearFilters("?kind=vital&vital=weight&upcoming=1")).toBe("?upcoming=1");
  });

  it("drops a stray vital parameter when another filter changes", () => {
    expect(setAuthor("?kind=symptom&vital=weight", ALEX)).toBe(`?kind=symptom&author=${ALEX}`);
  });

  it("is a filter", () => {
    expect(hasFilters(parseFilters("?kind=vital&vital=weight"))).toBe(true);
  });
});

describe("the search's care period (?period=)", () => {
  const PERIOD = "3f2b8c1e-5d1a-4c2e-9a77-0b6f3c1e0042";

  it("is read only while searching", () => {
    expect(parseFilters(`?q=knee&period=${PERIOD}`).period).toBe(PERIOD);
    expect(parseFilters(`?q=knee&period=${PERIOD.toUpperCase()}`).period).toBe(PERIOD);
    expect(parseFilters(`?period=${PERIOD}`).period).toBeNull();
    expect(parseFilters(`?kind=note&period=${PERIOD}`)).toEqual({
      kind: "note",
      author: null,
      q: "",
      period: null,
      vital: null,
    });
    expect(parseFilters("?q=knee&period=rehab").period).toBeNull();
  });

  it("is set only while searching, after the search, keeping the rest", () => {
    expect(setPeriod("?q=knee&kind=note&x=1", PERIOD)).toBe(`?kind=note&q=knee&period=${PERIOD}&x=1`);
    expect(setPeriod("?kind=note", PERIOD)).toBe("?kind=note");
    expect(setPeriod("?q=knee", "rehab")).toBe("?q=knee");
    const on = `?q=knee&period=${PERIOD}`;
    expect(setPeriod(on, PERIOD)).toBe(on);
  });

  it("clears alone, keeping the search and the other filters", () => {
    expect(clearPeriod(`?kind=note&q=knee&period=${PERIOD}`)).toBe("?kind=note&q=knee");
    expect(clearPeriod("?q=knee")).toBe("?q=knee");
  });

  it("goes with the search", () => {
    const on = `?kind=note&q=knee&period=${PERIOD}`;
    expect(clearQuery(on)).toBe("?kind=note");
    expect(setQuery(on, "  ")).toBe("?kind=note");
    expect(clearFilters(on)).toBe("");
    expect(setQuery(on, "hip")).toBe(`?kind=note&q=hip&period=${PERIOD}`);
  });

  it("is dropped by any change while there's no search", () => {
    expect(setKind(`?period=${PERIOD}`, "note")).toBe("?kind=note");
    expect(clearKind(`?period=${PERIOD}`)).toBe(`?period=${PERIOD}`);
  });
});
