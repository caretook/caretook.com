import type { ImportSource, ImportTarget } from "./providerImport";

import { describe, expect, it } from "vitest";
import { alreadyHereIds, foldName, planImport } from "./providerImport";

// Fictional providers in a source group, and what the target already has.

const source = (overrides: Partial<ImportSource> & Pick<ImportSource, "id" | "name">): ImportSource => ({
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

const HARBOR = source({
  id: "s-harbor",
  type: "practice",
  name: "Harbor Clinic",
  phones: [{ label: "Front desk", number: "(555) 010-1100" }],
  isPrimary: true,
});
const OKAFOR = source({
  id: "s-okafor",
  name: "Dr. Nia Okafor",
  specialty: "Geriatrics",
  practiceId: HARBOR.id,
  phones: [{ label: "Office", number: "(555) 010-1101 x12" }],
  email: "n.okafor@harbor.example",
  address: "9 Harbor Rd\nSpringfield, CA 90000",
  website: "harbor.example",
  status: "past",
  isPrimary: true,
});
const BRANDT = source({ id: "s-brandt", name: "Dr. Leo Brandt", practiceId: HARBOR.id });
const ELM = source({ id: "s-elm", type: "pharmacy", name: "Elm Street Pharmacy" });
const GONE = source({
  id: "s-gone",
  type: "practice",
  name: "Closed Clinic",
  deletedAt: "2026-11-01T00:00:00Z",
});
const ORPHAN = source({ id: "s-orphan", name: "Dr. Ida Moss", practiceId: GONE.id });
const SOURCE = [HARBOR, OKAFOR, BRANDT, ELM, GONE, ORPHAN];

const target = (id: string, type: ImportTarget["type"], name: string, deletedAt: string | null = null) => ({
  id,
  type,
  name,
  deletedAt,
});

const ids = () => {
  let n = 0;
  return () => `new-${++n}`;
};

describe("planImport", () => {
  it("copies the contact details and status, with primary off and a new id", () => {
    const plan = planImport(
      [ELM, OKAFOR],
      [target("t-harbor", "practice", "Harbor Clinic")],
      [OKAFOR.id],
      ids(),
    );
    expect(plan.rows).toEqual([
      {
        id: "new-1",
        sourceId: OKAFOR.id,
        content: {
          type: "clinician",
          name: "Dr. Nia Okafor",
          specialty: "Geriatrics",
          practiceId: null,
          phones: [{ label: "Office", number: "(555) 010-1101 x12" }],
          email: "n.okafor@harbor.example",
          address: "9 Harbor Rd\nSpringfield, CA 90000",
          website: "harbor.example",
          status: "past",
          isPrimary: false,
        },
      },
    ]);
    expect(plan.results).toEqual([
      { sourceId: OKAFOR.id, status: "added", id: "new-1", practice: null, practiceId: null },
    ]);
  });

  it("skips a provider with the same type and folded name here; a deleted one or another type doesn't count", () => {
    const here = [
      target("t-1", "clinician", "  dr.  nia OKAFÓR "),
      target("t-2", "pharmacy", "Elm Street Pharmacy", "2026-11-01T00:00:00Z"),
      target("t-3", "clinician", "Dr. Leo Brandt"),
    ];
    const plan = planImport(SOURCE, here, [OKAFOR.id, ELM.id, BRANDT.id], ids());
    expect(plan.results.map((r) => [r.sourceId, r.status, r.id])).toEqual([
      [OKAFOR.id, "alreadyHere", "t-1"],
      [ELM.id, "added", "new-1"],
      [BRANDT.id, "alreadyHere", "t-3"],
    ]);
    expect(plan.rows.map((r) => r.sourceId)).toEqual([ELM.id]);
    expect(alreadyHereIds(SOURCE, here)).toEqual(new Set([OKAFOR.id, BRANDT.id]));
  });

  it("reuses a practice here with the same type and name", () => {
    const plan = planImport(SOURCE, [target("t-harbor", "practice", "harbor clinic")], [BRANDT.id], ids());
    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0]!.content.practiceId).toBe("t-harbor");
    expect(plan.results).toEqual([
      { sourceId: BRANDT.id, status: "added", id: "new-1", practice: "reused", practiceId: "t-harbor" },
    ]);
  });

  it("copies a practice once for two of its clinicians, before them; a pharmacy of that name isn't the practice", () => {
    const plan = planImport(
      SOURCE,
      [target("t-x", "pharmacy", "Harbor Clinic")],
      [OKAFOR.id, BRANDT.id],
      ids(),
    );
    expect(plan.rows.map((r) => [r.id, r.sourceId, r.content.practiceId])).toEqual([
      ["new-1", HARBOR.id, null],
      ["new-2", OKAFOR.id, "new-1"],
      ["new-3", BRANDT.id, "new-1"],
    ]);
    expect(plan.rows[0]!.content).toMatchObject({ type: "practice", isPrimary: false });
    expect(plan.results.map((r) => [r.status, r.practice, r.practiceId])).toEqual([
      ["added", "copied", "new-1"],
      ["added", "copied", "new-1"],
    ]);
  });

  it("a clinician chosen with its practice points at that copy, whichever comes first", () => {
    const plan = planImport(SOURCE, [], [BRANDT.id, HARBOR.id], ids());
    expect(plan.rows.map((r) => [r.sourceId, r.content.practiceId])).toEqual([
      [HARBOR.id, null],
      [BRANDT.id, "new-1"],
    ]);
    expect(plan.results).toEqual([
      { sourceId: BRANDT.id, status: "added", id: "new-2", practice: "copied", practiceId: "new-1" },
      { sourceId: HARBOR.id, status: "added", id: "new-1", practice: null, practiceId: null },
    ]);
  });

  it("drops a deleted source practice: the copy has none, and the practice isn't copied", () => {
    const plan = planImport(SOURCE, [], [ORPHAN.id], ids());
    expect(plan.rows.map((r) => [r.sourceId, r.content.practiceId])).toEqual([[ORPHAN.id, null]]);
    expect(plan.results[0]).toMatchObject({ status: "added", practice: null });
  });

  it("ignores unknown, deleted and repeated ids", () => {
    const plan = planImport(SOURCE, [], ["nope", GONE.id, ELM.id, ELM.id], ids());
    expect(plan.results.map((r) => r.sourceId)).toEqual([ELM.id]);
    expect(plan.rows).toHaveLength(1);
  });

  it("two source providers with one name make one copy; the second is already here", () => {
    const twin = source({ id: "s-twin", type: "pharmacy", name: "elm street  pharmacy" });
    const plan = planImport([ELM, twin], [], [ELM.id, twin.id], ids());
    expect(plan.results.map((r) => [r.status, r.id])).toEqual([
      ["added", "new-1"],
      ["alreadyHere", "new-1"],
    ]);
  });
});

describe("foldName", () => {
  it("ignores case, accents and spacing", () => {
    expect(foldName("  Dr.  José   Ruiz ")).toBe("dr. jose ruiz");
  });
});
