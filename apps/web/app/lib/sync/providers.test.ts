import type { ProviderRow } from "./providers";

import { describe, expect, it } from "vitest";
import {
  deleteBlockedNote,
  practiceDependentsQuery,
  practiceHasProvidersRefusal,
  practiceInUseRefusal,
  toProvider,
  toProviders,
} from "./providers";

const row = (overrides: Partial<ProviderRow> = {}): ProviderRow => ({
  id: "p1",
  group_id: "g1",
  type: "clinician",
  name: "Dr. Example",
  specialty: "Cardiology",
  practice_id: null,
  phones: JSON.stringify([{ label: "Office", number: "555 0100" }]),
  email: null,
  address: null,
  website: null,
  status: "current",
  is_primary: 1,
  deleted_at: null,
  created_at: "2026-11-17T21:45:25.229000Z",
  updated_at: "2026-11-17T21:45:25.229000Z",
  created_by: "u1",
  updated_by: "u1",
  ...overrides,
});

describe("toProvider", () => {
  it("maps a synced row: phones from JSON, 1/0 as a boolean, ISO timestamps", () => {
    expect(toProvider(row())).toMatchObject({
      id: "p1",
      groupId: "g1",
      type: "clinician",
      phones: [{ label: "Office", number: "555 0100" }],
      isPrimary: true,
      status: "current",
      deletedAt: null,
      createdAt: "2026-11-17T21:45:25.229Z",
    });
    expect(toProvider(row({ is_primary: 0, deleted_at: "2026-11-18T08:00:00.000000Z" }))).toMatchObject({
      isPrimary: false,
      deletedAt: "2026-11-18T08:00:00.000Z",
    });
  });

  it("treats malformed phones as none and an unknown status as current", () => {
    expect(toProvider(row({ phones: "{", status: "retired" }))).toMatchObject({
      phones: [],
      status: "current",
    });
  });

  it("skips rows this build can't show", () => {
    expect(
      toProviders([row(), row({ id: "p2", type: "dentist" }), row({ id: "p3", name: null })]),
    ).toHaveLength(1);
  });
});

describe("practiceInUseRefusal", () => {
  const issue = {
    path: "type",
    message: "Clinicians are linked to this practice. Move them to another practice first.",
  };

  it("refuses a practice or pharmacy leaving the practice types while providers name it", () => {
    for (const from of ["practice", "pharmacy"] as const) {
      for (const to of ["clinician", "other"] as const) {
        expect(practiceInUseRefusal(from, to, 1)).toEqual({
          ok: false,
          error: issue.message,
          issues: [issue],
        });
      }
    }
  });

  it("allows practice ↔ pharmacy, no dependents, and other types", () => {
    expect(practiceInUseRefusal("practice", "pharmacy", 3)).toBeNull();
    expect(practiceInUseRefusal("pharmacy", "practice", 3)).toBeNull();
    expect(practiceInUseRefusal("practice", "clinician", 0)).toBeNull();
    expect(practiceInUseRefusal("clinician", "other", 2)).toBeNull();
  });

  it("counts only live providers in the group", () => {
    const q = practiceDependentsQuery("g1", "p1");
    expect(q.params).toEqual(["g1", "p1"]);
    expect(q.sql).toMatch(/group_id = \?/);
    expect(q.sql).toMatch(/practice_id = \?/);
    expect(q.sql).toMatch(/deleted_at IS NULL/);
  });
});

describe("practiceHasProvidersRefusal", () => {
  it("refuses deleting a provider others name as their practice, with the server's message", () => {
    expect(practiceHasProvidersRefusal(2)).toEqual({
      ok: false,
      error: "Providers are linked to this practice. Move them to another practice, or delete them, first.",
      issues: [],
    });
    expect(practiceHasProvidersRefusal(0)).toBeNull();
  });
});

describe("deleteBlockedNote", () => {
  it("counts the providers that name a practice or pharmacy", () => {
    expect(deleteBlockedNote("practice", 1)).toBe(
      "1 provider is linked to this practice. Move them to another practice, or delete them, first.",
    );
    expect(deleteBlockedNote("pharmacy", 2)).toMatch(/^2 providers are linked to this pharmacy\./);
  });

  it("is null when nothing names it", () => {
    expect(deleteBlockedNote("practice", 0)).toBeNull();
    expect(deleteBlockedNote("clinician", 3)).toBeNull();
  });
});
