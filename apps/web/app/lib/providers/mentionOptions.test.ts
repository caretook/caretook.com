import type { MentionProvider } from "./mentionOptions";

import { describe, expect, it } from "vitest";
import { MENTION_LIMIT, mentionOptions } from "./mentionOptions";

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
