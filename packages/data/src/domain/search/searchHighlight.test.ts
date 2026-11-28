import { describe, expect, it } from "vitest";
import { parseSearch } from "./search";
import {
  highlightParts,
  notesSnippet,
  highlightRanges,
  searchSnippet,
  SNIPPET_LENGTH,
  snippetIfHidden,
  wordStem,
} from "./searchHighlight";

const marked = (text: string, q: string) =>
  highlightRanges(text, parseSearch(q)).map((r) => text.slice(r.start, r.end));

describe("highlightRanges", () => {
  it("folds case and accents, keeping the shown text's own spelling", () => {
    expect(marked("Saw José at the Clinic", "jose clinic")).toEqual(["José", "Clinic"]);
    expect(marked("Müller called", "MULLER")).toEqual(["Müller"]);
  });

  it("marks whole words for a prefix, never part of one", () => {
    const text = "Blood pressure was high";
    expect(marked(text, "pres")).toEqual(["pressure"]);
    expect(highlightRanges(text, parseSearch("pres"))).toEqual([{ start: 6, end: 14 }]);
    // A prefix inside a word doesn't match.
    expect(marked("depressed", "pres")).toEqual([]);
  });

  it("marks other forms of a word (stems)", () => {
    expect(marked("She walked to the park, then walks again", "walking")).toEqual(["walked", "walks"]);
    expect(marked("Still hoping for news", '"hope"')).toEqual(["hoping"]);
    expect(marked("Two falls this week", '"fall"')).toEqual(["falls"]);
    expect(marked("walking slowly", "walki")).toEqual(["walking"]);
  });

  it("marks a phrase only in order, as one stretch", () => {
    expect(marked("He was short of breath on the stairs", '"short of breath"')).toEqual(["short of breath"]);
    expect(marked("breath was short", '"short of breath"')).toEqual([]);
  });

  it("marks words typed with punctuation inside as one stretch", () => {
    expect(marked("Called Dr. O'Brien", "o'brien")).toEqual(["O'Brien"]);
  });

  it("never marks excluded words", () => {
    expect(marked("fall and dizzy spell", "fall -dizzy")).toEqual(["fall"]);
  });

  it("is empty for no match, no text or no words", () => {
    expect(marked("Lunch at noon", "knee")).toEqual([]);
    expect(highlightRanges(null, parseSearch("knee"))).toEqual([]);
    expect(highlightRanges("knee", parseSearch("-knee"))).toEqual([]);
  });

  it("merges overlapping matches", () => {
    expect(marked("left knee pain", '"left knee" knee')).toEqual(["left knee"]);
  });
});

describe("highlightParts", () => {
  it("splits text into plain and matched parts", () => {
    const text = "a knee b";
    expect(highlightParts(text, highlightRanges(text, parseSearch("knee")))).toEqual([
      { text: "a ", match: false },
      { text: "knee", match: true },
      { text: " b", match: false },
    ]);
  });
});

describe("wordStem", () => {
  it("folds common endings together", () => {
    expect(wordStem("walking")).toBe(wordStem("walked"));
    expect(wordStem("walks")).toBe(wordStem("walk"));
    expect(wordStem("hopping")).toBe("hop");
    expect(wordStem("ponies")).toBe(wordStem("pony"));
    expect(wordStem("falling")).toBe("fall");
    expect(wordStem("bus")).toBe("bus");
  });
});

describe("searchSnippet", () => {
  const filler = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

  it("is null for text with no match", () => {
    expect(searchSnippet("Lunch at noon", parseSearch("knee"))).toBeNull();
    expect(searchSnippet("", parseSearch("knee"))).toBeNull();
  });

  it("shows short text whole, without ellipses", () => {
    expect(searchSnippet("Knee hurts", parseSearch("knee"))).toEqual({
      text: "Knee hurts",
      ranges: [{ start: 0, end: 4 }],
    });
  });

  it("cuts long text around a deep match on word boundaries, with ellipses", () => {
    const text = `${filler(40)} the dizziness came back ${filler(40)}`;
    const snippet = searchSnippet(text, parseSearch("dizzy"))!;
    expect(snippet.text.startsWith("…")).toBe(true);
    expect(snippet.text.endsWith("…")).toBe(true);
    expect(snippet.text.length).toBeLessThanOrEqual(SNIPPET_LENGTH + 2);
    expect(snippet.text.length).toBeGreaterThan(SNIPPET_LENGTH - 20);
    // Every word is whole.
    for (const word of snippet.text.replace(/…/g, "").split(" ")) {
      expect(word).toMatch(/^(word\d+|the|dizziness|came|back)$/);
    }
    expect(snippet.ranges.map((r) => snippet.text.slice(r.start, r.end))).toEqual(["dizziness"]);
  });

  it("puts a little context before the match", () => {
    const text = `${filler(40)} knee ${filler(40)}`;
    const snippet = searchSnippet(text, parseSearch("knee"))!;
    const at = snippet.text.indexOf("knee");
    expect(at).toBeGreaterThan(15);
    expect(at).toBeLessThan(SNIPPET_LENGTH / 2);
  });

  it("starts at the beginning when the match is near it", () => {
    const text = `Knee ${filler(60)}`;
    const snippet = searchSnippet(text, parseSearch("knee"))!;
    expect(snippet.text.startsWith("Knee")).toBe(true);
    expect(snippet.text.endsWith("…")).toBe(true);
  });

  it("keeps the text on one line", () => {
    const snippet = searchSnippet("First line\n\nSecond   line with knee\n• bullet", parseSearch("knee"))!;
    expect(snippet.text).toBe("First line Second line with knee • bullet");
  });

  it("keeps a phrase that ends the window whole", () => {
    const text = `${filler(10)} "short of breath" again`;
    const snippet = searchSnippet(text, parseSearch('"short of breath"'), 20)!;
    expect(snippet.ranges.map((r) => snippet.text.slice(r.start, r.end))).toEqual(["short of breath"]);
  });
});

describe("snippetIfHidden", () => {
  const q = parseSearch("knee");

  it("is null when the match is in the first lines, or there's none", () => {
    expect(snippetIfHidden("Knee is better today", q)).toBeNull();
    expect(snippetIfHidden("Line one\nknee on line two", q)).toBeNull();
    expect(snippetIfHidden("Nothing here", q)).toBeNull();
    expect(snippetIfHidden(null, q)).toBeNull();
  });

  it("gives a snippet when the match is past the clamp", () => {
    expect(snippetIfHidden(`${"Long day. ".repeat(12)}Then the knee gave way.`, q)?.text).toContain("knee");
    expect(snippetIfHidden("One\nTwo\nThree with knee", q)?.text).toBe("One Two Three with knee");
  });
});

describe("notesSnippet", () => {
  const notes = "Prefers morning visits. Take with food, never on an empty stomach.";

  it("snippets the notes when a word is only there", () => {
    const snippet = notesSnippet(["Metformin 500 mg", "1 tablet · 8:00"], notes, parseSearch("food"));
    expect(snippet?.text).toBe(notes);
    expect(snippet?.ranges.map((r) => snippet.text.slice(r.start, r.end))).toEqual(["food"]);
  });

  it("snippets the notes when one of several words is only there", () => {
    expect(notesSnippet(["Metformin 500 mg"], notes, parseSearch("metformin food"))).not.toBeNull();
  });

  it("is null when what's shown already matches, or the notes don't", () => {
    expect(notesSnippet(["Food allergy clinic"], notes, parseSearch("food"))).toBeNull();
    expect(notesSnippet(["Metformin"], notes, parseSearch("knee"))).toBeNull();
    expect(notesSnippet(["Metformin"], null, parseSearch("food"))).toBeNull();
  });
});
