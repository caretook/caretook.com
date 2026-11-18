import type { ProviderRow } from "./providers";

import { describe, expect, it } from "vitest";
import { toProvider, toProviders } from "./providers";

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
