import type { LinkUse, SuggestibleProvider } from "./providerSuggestions";

import { describe, expect, it } from "vitest";
import { nameWords, PROVIDER_SUGGESTION_LIMIT, suggestProviders, titleKey } from "./providerSuggestions";

const NOW = Date.parse("2026-11-17T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

const provider = (
  id: string,
  name: string,
  type: SuggestibleProvider["type"] = "clinician",
  more: Partial<SuggestibleProvider> = {},
): SuggestibleProvider => ({ id, type, name, status: "current", deletedAt: null, ...more });

const PATEL = provider("patel", "Dr. Samuel Patel");
const ALVAREZ = provider("alvarez", "Dr. Elena Alvarez, MD");
const WESTSIDE = provider("westside", "Westside Family Medicine", "practice");
const CORNERSTONE = provider("cornerstone", "Cornerstone Pharmacy", "pharmacy");
const MARIA = provider("maria", "Maria Reyes", "other");
const WU = provider("wu", "Dr. Amy Wu");
const ALL = [PATEL, ALVAREZ, WESTSIDE, CORNERSTONE, MARIA, WU];

const link = (
  providerId: string,
  title: string | null,
  days: number,
  entryId = `e-${title}-${days}`,
): LinkUse => ({
  providerId,
  entryId,
  title,
  linkedAt: daysAgo(days),
});

const ids = (input: Partial<Parameters<typeof suggestProviders>[0]>) =>
  suggestProviders({ title: null, text: null, providers: ALL, history: [], now: NOW, ...input }).map(
    (p) => p.id,
  );

describe("nameWords", () => {
  it("folds case and accents, splits on punctuation, and drops honorifics", () => {
    expect(nameWords("Dr. José O'Neil-Smith, MD")).toEqual(["jose", "o", "neil", "smith"]);
    expect(nameWords("Mrs. Li of Oak")).toEqual(["li", "of", "oak"]);
  });
});

describe("titleKey", () => {
  it("ignores case, punctuation and spacing", () => {
    expect(titleKey("  Cardiology   visit! ")).toBe("cardiology visit");
    expect(titleKey("cardiology-visit")).toBe("cardiology visit");
  });

  it("is null for a blank title and the default Event", () => {
    expect(titleKey("  ")).toBeNull();
    expect(titleKey(null)).toBeNull();
    expect(titleKey("event")).toBeNull();
  });
});

describe("suggestProviders: names in the title or text", () => {
  it("matches a clinician's last name, ignoring the honorific", () => {
    expect(ids({ title: "Dr. Patel follow-up" })).toEqual(["patel"]);
    expect(ids({ title: "patel follow-up" })).toEqual(["patel"]);
  });

  it("matches a clinician's full name, accents and credentials aside", () => {
    expect(ids({ text: "Saw elena alvarez today" })).toEqual(["alvarez"]);
    expect(ids({ text: "Saw Álvarez today" })).toEqual(["alvarez"]);
  });

  it("matches whole words only", () => {
    expect(ids({ title: "Patelson visit" })).toEqual([]);
    expect(ids({ title: "Cornerstones" })).toEqual([]);
  });

  it("never matches on an honorific or a short word", () => {
    // "Dr" alone, and a last name under 3 letters, are no match…
    expect(ids({ title: "Dr visit with Wu" })).toEqual([]);
    expect(ids({ title: "Dr. visit", providers: [provider("dr", "Dr. Do")] })).toEqual([]);
    // …but the whole name still is.
    expect(ids({ title: "Amy Wu" })).toEqual(["wu"]);
  });

  it("matches a practice or pharmacy by its whole name only", () => {
    expect(ids({ title: "Westside Family Medicine check-in" })).toEqual(["westside"]);
    expect(ids({ title: "Family medicine check-in" })).toEqual([]);
    expect(ids({ title: "Pharmacy pickup" })).toEqual([]);
    expect(ids({ text: "Picked up at cornerstone pharmacy." })).toEqual(["cornerstone"]);
  });

  it("matches an other contact like a person", () => {
    expect(ids({ text: "Reyes stayed late" })).toEqual(["maria"]);
  });

  it("puts title matches before text matches, then the earliest mention", () => {
    expect(ids({ title: "Alvarez", text: "Patel called, then Cornerstone Pharmacy" })).toEqual([
      "alvarez",
      "patel",
      "cornerstone",
    ]);
    expect(ids({ text: "Cornerstone Pharmacy first, Patel second" })).toEqual(["cornerstone", "patel"]);
  });

  it("doesn't match on the default Event title", () => {
    const event = provider("event", "Event Planning Co", "other");
    expect(ids({ title: "Event", providers: [event] })).toEqual([]);
  });
});

describe("suggestProviders: title memory", () => {
  it("suggests who was linked to earlier entries with the same title", () => {
    const history = [link("cornerstone", "Pharmacy pickup", 30), link("patel", "Cardiology visit", 1)];
    expect(ids({ title: "pharmacy  PICKUP", history })[0]).toBe("cornerstone");
  });

  it("ranks after name matches", () => {
    const history = [link("cornerstone", "Patel visit", 3)];
    expect(ids({ title: "Patel visit", history })).toEqual(["patel", "cornerstone"]);
  });

  it("ignores the entry's own links", () => {
    const history = [link("patel", "Old title", 1, "this"), link("maria", "Check-in", 20)];
    expect(ids({ title: "Check-in", history, entryId: "this" })).toEqual(["maria"]);
  });
});

describe("suggestProviders: recent links", () => {
  it("suggests recently linked providers when nothing else matches", () => {
    const history = [link("maria", "A", 2), link("patel", "B", 1)];
    expect(ids({ history })).toEqual(["patel", "maria"]);
  });

  it("decays with a 14-day half-life, so recent beats many old", () => {
    const history = [
      link("patel", "A", 60),
      link("patel", "B", 61),
      link("patel", "C", 62),
      link("maria", "D", 3),
    ];
    expect(ids({ history })).toEqual(["maria", "patel"]);
    // Two links a week ago beat one yesterday.
    const often = [link("patel", "A", 7), link("patel", "B", 7), link("maria", "C", 1)];
    expect(ids({ history: often })).toEqual(["patel", "maria"]);
  });

  it("comes after title memory, and lists each provider once", () => {
    const history = [link("maria", "Visit", 1), link("patel", "Visit", 1), link("cornerstone", "Other", 0)];
    expect(ids({ title: "Visit", history })).toEqual(["maria", "patel", "cornerstone"]);
  });
});

describe("suggestProviders: exclusions and the limit", () => {
  it("leaves out past and deleted providers", () => {
    const past = provider("past", "Dr. Alan Whitford", "clinician", { status: "past" });
    const gone = provider("gone", "Dr. Ruth Gone", "clinician", { deletedAt: daysAgo(1) });
    const history = [link("past", "A", 1), link("gone", "B", 1)];
    expect(ids({ title: "Whitford and Gone", providers: [past, gone], history })).toEqual([]);
  });

  it("leaves out providers named in `exclude`, and history for unknown providers", () => {
    const history = [link("someone-else", "A", 1)];
    expect(ids({ title: "Patel Alvarez", exclude: ["patel"], history })).toEqual(["alvarez"]);
  });

  it(`returns at most ${PROVIDER_SUGGESTION_LIMIT}, or the limit given`, () => {
    const many = Array.from({ length: 8 }, (_, i) => provider(`p${i}`, `Person Name${"x".repeat(i)}`));
    const history = many.map((p, i) => link(p.id, "A", i));
    expect(ids({ providers: many, history })).toHaveLength(PROVIDER_SUGGESTION_LIMIT);
    expect(ids({ providers: many, history, limit: 2 })).toEqual(["p0", "p1"]);
    expect(ids({ providers: many, history, limit: 0 })).toEqual([]);
  });
});
