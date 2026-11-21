import type { GroupRow } from "../timeline/timeline.sync";

import { describe, expect, it } from "vitest";
import { toGroupContext } from "./groupContext";

const row = (patch: Partial<GroupRow> = {}): GroupRow => ({
  id: "g1",
  name: "Dev Family",
  role: "caretaker",
  recipient_id: "r1",
  recipient_name: "Patricia",
  recipient_preferred_name: "Grandma Pat",
  recipient_time_zone: "America/Los_Angeles",
  simple_mode: 0,
  simple_mode_locked: 0,
  ...patch,
});

describe("toGroupContext", () => {
  it("names the group after its recipient's preferred name", () => {
    expect(toGroupContext(row(), "u1")).toEqual({
      userId: "u1",
      id: "g1",
      name: "Dev Family",
      displayName: "Grandma Pat",
      role: "caretaker",
      canWrite: true,
      recipient: {
        id: "r1",
        name: "Patricia",
        preferredName: "Grandma Pat",
        displayName: "Grandma Pat",
        timeZone: "America/Los_Angeles",
      },
      easyMode: { ownerDefault: false, locked: false },
    });
  });

  it("carries the managers' easy-mode default and lock", () => {
    expect(toGroupContext(row({ simple_mode: 1, simple_mode_locked: 1 }), "u1").easyMode).toEqual({
      ownerDefault: true,
      locked: true,
    });
    expect(toGroupContext(row({ simple_mode: null, simple_mode_locked: null }), "u1").easyMode).toEqual({
      ownerDefault: false,
      locked: false,
    });
  });

  it("falls back to the recipient's name, then the group's", () => {
    expect(toGroupContext(row({ recipient_preferred_name: "" }), "u1").displayName).toBe("Patricia");
    expect(toGroupContext(row({ recipient_preferred_name: null }), "u1").recipient?.preferredName).toBeNull();
    const none = toGroupContext(row({ recipient_id: null }), "u1");
    expect(none.recipient).toBeNull();
    expect(none.displayName).toBe("Dev Family");
  });

  it("lets owners, admins and caretakers write, and nobody else", () => {
    expect(toGroupContext(row({ role: "owner" }), "u").canWrite).toBe(true);
    expect(toGroupContext(row({ role: "admin" }), "u").canWrite).toBe(true);
    expect(toGroupContext(row({ role: "viewer" }), "u").canWrite).toBe(false);
    expect(toGroupContext(row({ role: "superuser" }), "u").canWrite).toBe(false);
    expect(toGroupContext(row({ role: null }), "u")).toMatchObject({ role: null, canWrite: false });
  });
});
