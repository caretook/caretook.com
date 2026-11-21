import type { OtherGroupProviders } from "./fromGroups";
import type { MentionProvider } from "./mentionOptions";

import { describe, expect, it } from "vitest";
import {
  MENTION_LIMIT,
  mentionAddRow,
  mentionChoices,
  mentionOptions,
  mentionQueryOpen,
} from "./mentionOptions";

const p = (id: string, name: string, extra: Partial<MentionProvider> = {}): MentionProvider => ({
  id,
  type: "clinician",
  name,
  specialty: null,
  practiceId: null,
  status: "current",
  isPrimary: false,
  deletedAt: null,
  ...extra,
});

const clinic = p("c", "Westside Family Medicine", { type: "practice" });
const alvarez = p("a", "Dr. Elena Alvarez", { specialty: "Primary care", practiceId: "c", isPrimary: true });
const patel = p("b", "Dr. Samuel Patel", { specialty: "Cardiology" });
const pharmacy = p("d", "Cornerstone Pharmacy", { type: "pharmacy" });
const past = p("e", "Dr. Old Doc", { status: "past" });
const gone = p("f", "Dr. Gone", { deletedAt: "2026-11-01T00:00:00.000Z" });
const jose = p("g", "José Núñez", { type: "other", specialty: "Home health aide" });
const all = [patel, pharmacy, past, gone, clinic, alvarez, jose];

describe("mentionOptions", () => {
  it("lists live providers in display order: primary first, then current, then past", () => {
    expect(mentionOptions(all, "").map((o) => o.id)).toEqual(["a", "d", "b", "g", "c", "e"]);
  });

  it("leaves out deleted providers", () => {
    expect(mentionOptions(all, "gone")).toEqual([]);
    expect(mentionOptions(all, "").map((o) => o.id)).not.toContain("f");
  });

  it("matches every word in the name, specialty or practice name, case and accents ignored", () => {
    expect(mentionOptions(all, "cardio").map((o) => o.id)).toEqual(["b"]);
    expect(mentionOptions(all, "westside").map((o) => o.id)).toEqual(["a", "c"]);
    expect(mentionOptions(all, "DR samuel").map((o) => o.id)).toEqual(["b"]);
    expect(mentionOptions(all, "jose nunez").map((o) => o.id)).toEqual(["g"]);
    expect(mentionOptions(all, "samuel nobody")).toEqual([]);
  });

  it("names each and says what it is: specialty or type, practice, past", () => {
    const byId = Object.fromEntries(mentionOptions(all, "").map((o) => [o.id, o]));
    expect(byId.a).toEqual({
      id: "a",
      label: "Dr. Elena Alvarez",
      description: "Primary care · Westside Family Medicine",
    });
    expect(byId.d!.description).toBe("Pharmacy");
    expect(byId.e!.description).toBe("Clinician · Past");
  });

  it(`stops at ${MENTION_LIMIT}, or the limit given`, () => {
    const many = Array.from({ length: 30 }, (_, i) => p(`m${String(i).padStart(2, "0")}`, `Dr. Many ${i}`));
    expect(mentionOptions(many, "")).toHaveLength(MENTION_LIMIT);
    expect(mentionOptions(all, "", 2).map((o) => o.id)).toEqual(["a", "d"]);
  });
});

describe("the add row", () => {
  const add = (name: string) => ({ kind: "add", name, label: `Add "${name}" as a provider` });

  it("ends the list for writers when no provider has exactly the typed name", () => {
    const rows = mentionChoices(all, "Dr. Chen", { canAdd: true });
    expect(rows).toEqual([add("Dr. Chen")]);
    // Partial matches stay above it: "Dr. Sam" isn't anyone's name.
    const sam = mentionChoices(all, "Dr. Sam", { canAdd: true });
    expect(sam.map((r) => (r.kind === "add" ? "add" : r.id))).toEqual(["b", "add"]);
    expect(sam.at(-1)).toEqual(add("Dr. Sam"));
  });

  it("is left out when a live provider has the name, case, accents and spacing ignored", () => {
    expect(mentionAddRow(all, "dr. samuel patel")).toBeNull();
    expect(mentionAddRow(all, "  Jose   NUNEZ ")).toBeNull();
    expect(mentionAddRow(all, "Cornerstone pharmacy")).toBeNull();
    // A deleted provider's name can be added again.
    expect(mentionAddRow(all, "Dr. Gone")).toEqual(add("Dr. Gone"));
  });

  it("takes the typed name trimmed, with single spaces", () => {
    expect(mentionAddRow(all, "  Dr.   Chen ")).toEqual(add("Dr. Chen"));
  });

  it("needs typed text", () => {
    expect(mentionAddRow(all, "")).toBeNull();
    expect(mentionAddRow(all, "   ")).toBeNull();
    expect(mentionChoices(all, "", { canAdd: true }).every((r) => r.kind === "provider")).toBe(true);
  });

  it("is for writers only", () => {
    expect(mentionChoices(all, "Dr. Chen", { canAdd: false })).toEqual([]);
    expect(mentionChoices(all, "cardio", { canAdd: false })).toEqual([
      { kind: "provider", id: "b", label: "Dr. Samuel Patel", description: "Cardiology" },
    ]);
  });

  it("comes after the full list of matches, whatever the limit", () => {
    const many = Array.from({ length: 30 }, (_, i) => p(`m${String(i).padStart(2, "0")}`, `Dr. Many ${i}`));
    const rows = mentionChoices(many, "Dr. Many", { canAdd: true });
    expect(rows).toHaveLength(MENTION_LIMIT + 1);
    expect(rows.at(-1)).toEqual(add("Dr. Many"));
  });
});

describe("mentionQueryOpen: spaces in what's typed after the @", () => {
  it("stays open for two words, or while the words before the last space match someone", () => {
    expect(mentionQueryOpen(all, "")).toBe(true);
    expect(mentionQueryOpen(all, "Mom")).toBe(true);
    expect(mentionQueryOpen(all, "Rosa Lind")).toBe(true);
    expect(mentionQueryOpen(all, "Dr. Chen")).toBe(true);
    expect(mentionQueryOpen(all, "dr samuel pat")).toBe(true);
  });

  it("closes once a third word starts after words that match nobody, or on a leading space", () => {
    expect(mentionQueryOpen(all, "Mom said ")).toBe(false);
    expect(mentionQueryOpen(all, "Mom said to")).toBe(false);
    expect(mentionQueryOpen(all, "Rosa Lind said")).toBe(false);
    expect(mentionQueryOpen(all, " 5pm")).toBe(false);
  });
});

describe("the other groups' sections", () => {
  const source = (id: string, name: string, extra: Partial<MentionProvider> = {}) => ({
    ...p(id, name, extra),
    phones: [],
    email: null,
    address: null,
    website: null,
  });
  const lou: OtherGroupProviders = {
    id: "lou",
    name: "Lou Lindqvist",
    providers: [
      source("s1", "Dr. Grace Lindqvist", { specialty: "Audiology" }),
      source("s2", "Dr. Samuel Patel"),
    ],
  };
  const kinds = (rows: ReturnType<typeof mentionChoices>) =>
    rows.map((r) => (r.kind === "add" ? "add" : `${r.kind}:${r.id}`));

  it("come after this group's matches and before the add row, minus ones already here", () => {
    const rows = mentionChoices(all, "samuel", { canAdd: true, others: [lou] });
    expect(kinds(rows)).toEqual(["provider:b", "add"]);
    const dr = mentionChoices(all, "dr", { canAdd: true, others: [lou] });
    expect(kinds(dr).slice(-2)).toEqual(["fromGroup:s1", "add"]);
    expect(dr.at(-2)).toEqual({
      kind: "fromGroup",
      id: "s1",
      groupId: "lou",
      heading: "From Lou Lindqvist",
      label: "Dr. Grace Lindqvist",
      description: "Audiology",
    });
  });

  it("show nothing while nothing is typed", () => {
    expect(
      kinds(mentionChoices(all, "", { canAdd: true, others: [lou] })).some((k) => k.startsWith("from")),
    ).toBe(false);
  });

  it("keep the popup open for a third word when the words before it match another group's", () => {
    expect(mentionQueryOpen(all, "Dr. Grace Lind")).toBe(false);
    expect(mentionQueryOpen(all, "Dr. Grace Lind", [lou])).toBe(true);
  });
});
