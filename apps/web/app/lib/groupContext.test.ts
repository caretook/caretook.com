import type { GroupRow } from "./sync/timeline";

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
