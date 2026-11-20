import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import {
  foldSearchText,
  isEmptySearch,
  parseSearch,
  prefixForms,
  SEARCH_MAX_TERMS,
  toFtsMatch,
  toTsQuery,
} from "./search";

describe("parseSearch", () => {
  it("reads words, each a prefix, folded", () => {
    expect(parseSearch("  Blood  PRES ")).toEqual({
      include: [
        { words: ["blood"], prefix: true },
        { words: ["pres"], prefix: true },
      ],
      exclude: [],
    });
    expect(parseSearch("José Müller").include.map((t) => t.words[0])).toEqual(["jose", "muller"]);
  });

  it("reads a quoted phrase as words in order, not a prefix", () => {
    expect(parseSearch('"short of breath" knee').include).toEqual([
      { words: ["short", "of", "breath"], prefix: false },
      { words: ["knee"], prefix: true },
    ]);
  });

  it('reads -word and -"phrase" as exclusions', () => {
    expect(parseSearch('fall -dizzy -"left knee"')).toEqual({
      include: [{ words: ["fall"], prefix: true }],
      exclude: [
        { words: ["dizzy"], prefix: false },
        { words: ["left", "knee"], prefix: false },
      ],
    });
  });

  it("keeps a word with punctuation inside together, as the tokenizers split it", () => {
    expect(parseSearch("O'Brien x-ray").include).toEqual([
      { words: ["o", "brien"], prefix: true },
      { words: ["x", "ray"], prefix: true },
    ]);
  });

  it("reads operators and junk as plain text, never syntax", () => {
    expect(parseSearch("knee AND NOT (pain) * ^ : {title}").include.map((t) => t.words)).toEqual([
      ["knee"],
      ["and"],
      ["not"],
      ["pain"],
      ["title"],
    ]);
    // A lone or doubled dash is not an exclusion.
    expect(parseSearch("- --knee").include).toEqual([{ words: ["knee"], prefix: true }]);
    expect(parseSearch("--knee").exclude).toEqual([]);
  });

  it("reads an unbalanced quote's words as plain words", () => {
    expect(parseSearch('"short of').include).toEqual([
      { words: ["short"], prefix: true },
      { words: ["of"], prefix: true },
    ]);
    expect(parseSearch('"a b" "c').include).toEqual([
      { words: ["a", "b"], prefix: false },
      { words: ["c"], prefix: true },
    ]);
  });

  it("caps the number of terms", () => {
    const parsed = parseSearch(Array.from({ length: 30 }, (_, i) => `w${i}`).join(" "));
    expect(parsed.include).toHaveLength(SEARCH_MAX_TERMS);
  });

  it("treats nothing, punctuation only and exclusions only as an empty search", () => {
    for (const text of ["", "   ", '"" ... !!', '-knee -"left hip"']) {
      expect(isEmptySearch(parseSearch(text))).toBe(true);
      expect(toFtsMatch(parseSearch(text))).toBeNull();
      expect(toTsQuery(parseSearch(text))).toBeNull();
    }
    expect(isEmptySearch(parseSearch("knee"))).toBe(false);
  });
});

describe("foldSearchText", () => {
  it("drops case and accents", () => {
    expect(foldSearchText("JOSÉ Ñandú Crème")).toBe("jose nandu creme");
  });
});

describe("prefixForms", () => {
  it("completes a prefix that runs past a stem", () => {
    expect(prefixForms("walki")).toEqual(expect.arrayContaining(["walki", "walking"]));
    expect(prefixForms("medica")).toEqual(["medica", "medication"]);
  });

  it("leaves short prefixes and plain words alone", () => {
    expect(prefixForms("pres")).toEqual(["pres"]);
    expect(prefixForms("ki")).toEqual(["ki"]);
  });
});

describe("toFtsMatch", () => {
  it("builds quoted prefix terms, phrases and exclusions", () => {
    expect(toFtsMatch(parseSearch('pres "short of breath" -fell'))).toBe(
      '(("pres"*) AND ("short of breath")) NOT ("fell")',
    );
    expect(toFtsMatch(parseSearch("walki"))).toBe('("walki"* OR "walking"* OR "walkies"*)');
    expect(toFtsMatch(parseSearch("o'bri"))).toBe('("o bri"*)');
  });

  it("can limit the included terms to some columns", () => {
    expect(toFtsMatch(parseSearch("knee -hip"), { columns: ["title"] })).toBe(
      '({title} : (("knee"* OR "kneed"*))) NOT ("hip")',
    );
  });

  // The match string is the interface: check it against a real FTS5 with the device's tokenizer.
  describe("against SQLite FTS5 (porter unicode61 remove_diacritics 2)", () => {
    const db = new DatabaseSync(":memory:");
    db.exec(
      `CREATE VIRTUAL TABLE t USING fts5(title, body, tokenize = 'porter unicode61 remove_diacritics 2')`,
    );
    const rows: [string, string][] = [
      ["Walk with José", "He was walking well, then short of breath."],
      ["Fall in the kitchen", "She fell. Two falls this week; dizzy after."],
      ["Blood pressure", "Taken after the medication."],
      ["Visit with Dr. O'Brien", "Knee x-ray looks fine."],
      ["Pharmacy pickup", "NOT ready AND late; (sigh) * {title}:"],
    ];
    const insert = db.prepare("INSERT INTO t (title, body) VALUES (?, ?)");
    for (const [title, body] of rows) insert.run(title, body);
    const titles = (text: string, columns?: string[]) => {
      const match = toFtsMatch(parseSearch(text), { columns });
      if (!match) return [];
      return db
        .prepare("SELECT title FROM t WHERE t MATCH ? ORDER BY rowid")
        .all(match)
        .map((r) => (r as { title: string }).title);
    };

    it("matches prefixes, word forms, case and accents", () => {
      expect(titles("pres")).toEqual(["Blood pressure"]);
      expect(titles("walked")).toEqual(["Walk with José"]);
      expect(titles("walki")).toEqual(["Walk with José"]);
      expect(titles("medica")).toEqual(["Blood pressure"]);
      expect(titles("falls")).toEqual(["Fall in the kitchen"]);
      expect(titles("JOSE")).toEqual(["Walk with José"]);
      expect(titles("josé")).toEqual(["Walk with José"]);
    });

    it("needs every word", () => {
      expect(titles("fall dizzy")).toEqual(["Fall in the kitchen"]);
      expect(titles("fall knee")).toEqual([]);
    });

    it("matches a phrase in order only", () => {
      expect(titles('"short of breath"')).toEqual(["Walk with José"]);
      expect(titles('"breath of short"')).toEqual([]);
    });

    it("excludes words and phrases", () => {
      expect(titles("after")).toEqual(["Fall in the kitchen", "Blood pressure"]);
      expect(titles("after -dizzy")).toEqual(["Blood pressure"]);
      expect(titles('after -"two falls"')).toEqual(["Blood pressure"]);
    });

    it("finds words with punctuation inside", () => {
      expect(titles("o'brien")).toEqual(["Visit with Dr. O'Brien"]);
      expect(titles("x-ray")).toEqual(["Visit with Dr. O'Brien"]);
      expect(titles("dr. o'bri")).toEqual(["Visit with Dr. O'Brien"]);
    });

    it("never fails on operators, junk or unbalanced quotes", () => {
      expect(titles("NOT ready AND")).toEqual(["Pharmacy pickup"]);
      expect(titles('(sigh) * {title}: "late')).toEqual(["Pharmacy pickup"]);
      expect(titles('NEAR( " ^ ) OR')).toEqual([]);
    });

    it("limits matching to a column", () => {
      expect(titles("knee")).toEqual(["Visit with Dr. O'Brien"]);
      expect(titles("knee", ["title"])).toEqual([]);
      expect(titles("visit -knee", ["title"])).toEqual([]);
    });
  });
});

describe("toTsQuery", () => {
  it("builds prefix lexemes, phrases and exclusions", () => {
    expect(toTsQuery(parseSearch('pres "short of breath" -fell -"left knee"'))).toBe(
      "'pres':* & ('short' <-> 'of' <-> 'breath') & !'fell' & !('left' <-> 'knee')",
    );
    expect(toTsQuery(parseSearch("walki"))).toBe("('walki':* | 'walking':* | 'walkies':*)");
    expect(toTsQuery(parseSearch("o'bri"))).toBe("('o' <-> 'bri':*)");
  });

  it("quotes every lexeme, so operators typed are plain words", () => {
    expect(toTsQuery(parseSearch("a & !b | c"))).toBe("'a':* & 'b':* & 'c':*");
  });
});
