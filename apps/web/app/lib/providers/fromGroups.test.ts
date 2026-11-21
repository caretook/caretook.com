import type { OtherGroupProviders } from "./fromGroups";
import type { ImportSource, ImportTarget } from "./providerImport";

import { describe, expect, it } from "vitest";
import { FROM_GROUP_LIMIT, fromGroupOption, fromGroupSections, providerDescription } from "./fromGroups";

// Fictional providers in two of the user's other groups, and this group's.

const src = (overrides: Partial<ImportSource> & Pick<ImportSource, "id" | "name">): ImportSource => ({
  type: "clinician",
  specialty: null,
  practiceId: null,
  phones: [],
  email: null,
  address: null,
  website: null,
  status: "current",
  isPrimary: false,
  deletedAt: null,
  ...overrides,
});

const harbor = src({ id: "h", type: "practice", name: "Harbor Clinic" });
const okafor = src({ id: "o", name: "Dr. Nia Okafor", specialty: "Geriatrics", practiceId: "h" });
const quinn = src({ id: "q", name: "Dr. Ada Quinn", specialty: "Neurology", status: "past" });
const lindqvist = src({ id: "l", name: "Dr. Grace Lindqvist", specialty: "Audiology", isPrimary: true });
const gone = src({ id: "g", name: "Dr. Nia Gone", deletedAt: "2026-11-01T00:00:00.000Z" });
const patelThere = src({ id: "p2", name: "dr. samuel  PATEL", specialty: "Cardiology" });

const LOU: OtherGroupProviders = {
  id: "lou",
  name: "Lou Lindqvist",
  providers: [harbor, okafor, quinn, gone],
};
const ROSA: OtherGroupProviders = { id: "rosa", name: "Rosa Park", providers: [lindqvist, patelThere] };

const here: ImportTarget[] = [
  { id: "p", type: "clinician", name: "Dr. Samuel Patel", deletedAt: null },
  { id: "x", type: "clinician", name: "Dr. Ada Quinn", deletedAt: "2026-11-02T00:00:00.000Z" },
];

const ids = (groups: ReturnType<typeof fromGroupSections>) =>
  groups.map((s) => [s.heading, s.options.map((o) => o.sourceId)]);

describe("fromGroupSections", () => {
  it("shows nothing until something is typed", () => {
    expect(fromGroupSections([LOU, ROSA], here, "")).toEqual([]);
    expect(fromGroupSections([LOU, ROSA], here, "   ")).toEqual([]);
  });

  it("lists matches only, every word in the name, specialty or practice name", () => {
    expect(ids(fromGroupSections([LOU, ROSA], here, "harbor"))).toEqual([["From Lou Lindqvist", ["o", "h"]]]);
    expect(ids(fromGroupSections([LOU, ROSA], here, "audio"))).toEqual([["From Rosa Park", ["l"]]]);
    expect(ids(fromGroupSections([LOU, ROSA], here, "dr nia"))).toEqual([["From Lou Lindqvist", ["o"]]]);
    expect(fromGroupSections([LOU, ROSA], here, "nobody")).toEqual([]);
  });

  it("leaves out deleted ones and ones already here (same type and folded name); a deleted one here doesn't count", () => {
    const dr = ids(fromGroupSections([LOU, ROSA], here, "dr"));
    expect(dr).toEqual([
      ["From Lou Lindqvist", ["o", "q"]],
      ["From Rosa Park", ["l"]],
    ]);
    expect(fromGroupSections([ROSA], here, "patel")).toEqual([]);
  });

  it("keeps each group's display order (primary, current, past) and the groups' order", () => {
    expect(ids(fromGroupSections([ROSA, LOU], here, "dr"))).toEqual([
      ["From Rosa Park", ["l"]],
      ["From Lou Lindqvist", ["o", "q"]],
    ]);
  });

  it(`stops at ${FROM_GROUP_LIMIT} per group, or the limit given`, () => {
    const many: OtherGroupProviders = {
      id: "many",
      name: "Many",
      providers: Array.from({ length: 8 }, (_, i) => src({ id: `m${i}`, name: `Dr. Many ${i}` })),
    };
    const [section] = fromGroupSections([many, LOU], here, "dr");
    expect(section!.options.map((o) => o.sourceId)).toEqual(["m0", "m1", "m2", "m3", "m4"]);
    expect(ids(fromGroupSections([many, LOU], here, "dr", 1))).toEqual([
      ["From Many", ["m0"]],
      ["From Lou Lindqvist", ["o"]],
    ]);
  });

  it("names each option and says what it is, with its practice from its own group", () => {
    const [section] = fromGroupSections([LOU], here, "okafor");
    expect(section).toEqual({
      groupId: "lou",
      heading: "From Lou Lindqvist",
      options: [
        { groupId: "lou", sourceId: "o", label: "Dr. Nia Okafor", description: "Geriatrics · Harbor Clinic" },
      ],
    });
    expect(fromGroupSections([LOU], here, "quinn")[0]!.options[0]!.description).toBe("Neurology · Past");
    expect(fromGroupOption(fromGroupSections([LOU, ROSA], here, "dr"), "l")?.groupId).toBe("rosa");
    expect(fromGroupOption(fromGroupSections([LOU], here, "dr"), "p")).toBeUndefined();
  });

  it("describes a provider by specialty or type, practice and past", () => {
    expect(providerDescription(harbor, null)).toBe("Practice");
    expect(providerDescription(quinn, "Harbor Clinic")).toBe("Neurology · Harbor Clinic · Past");
  });
});
