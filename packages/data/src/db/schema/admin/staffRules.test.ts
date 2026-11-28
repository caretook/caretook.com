import { describe, expect, it } from "vitest";
import {
  disableRefusal,
  isStaff,
  roleChangeRefusal,
  STAFF_CAPABILITY_NAMES,
  staffCan,
  staffCapabilities,
  staffReasonZSchema,
} from "./staffRules";

const SUPPORT = [
  "users.read",
  "users.help",
  "groups.read",
  "accessCodes.write",
  "staffGroups.create",
  "waitlist.read",
  "audit.read",
  "settings.read",
  "users.limits",
];
const ADMIN_ONLY = ["users.disable", "users.setRole", "groups.manage", "settings.write"];

describe("staffCan", () => {
  it.each(STAFF_CAPABILITY_NAMES)("%s: admin yes, member and nobody no", (capability) => {
    expect(staffCan(["admin"], capability)).toBe(true);
    expect(staffCan(["member"], capability)).toBe(false);
    expect(staffCan([], capability)).toBe(false);
    expect(staffCan(null, capability)).toBe(false);
    expect(staffCan(["system"], capability)).toBe(false);
  });

  it.each(STAFF_CAPABILITY_NAMES)("%s: support only where the PRD says", (capability) => {
    expect(staffCan(["support"], capability)).toBe(SUPPORT.includes(capability));
  });

  it("covers every capability between the two lists", () => {
    expect([...SUPPORT, ...ADMIN_ONLY].sort()).toEqual([...STAFF_CAPABILITY_NAMES].sort());
  });

  it("lists each role's capabilities in table order", () => {
    expect(staffCapabilities(["admin"])).toEqual(STAFF_CAPABILITY_NAMES);
    expect(staffCapabilities(["support"])).toEqual(STAFF_CAPABILITY_NAMES.filter((c) => SUPPORT.includes(c)));
    expect(staffCapabilities(["member"])).toEqual([]);
  });
});

describe("isStaff", () => {
  it("is admin and support only", () => {
    expect(isStaff(["admin"])).toBe(true);
    expect(isStaff(["support"])).toBe(true);
    expect(isStaff(["member"])).toBe(false);
    expect(isStaff(["system"])).toBe(false);
    expect(isStaff(undefined)).toBe(false);
  });
});

describe("roleChangeRefusal", () => {
  const base = { actorId: "a", targetId: "t", from: "member", to: "support", adminCount: 1 };

  it("allows a change to someone else", () => {
    expect(roleChangeRefusal(base)).toBeNull();
    expect(roleChangeRefusal({ ...base, from: "admin", to: "member", adminCount: 2 })).toBeNull();
  });

  it("refuses your own role", () => {
    expect(roleChangeRefusal({ ...base, targetId: "a" })).toBe("self");
  });

  it("never demotes the last admin", () => {
    expect(roleChangeRefusal({ ...base, from: "admin", to: "support", adminCount: 1 })).toBe("lastAdmin");
    expect(roleChangeRefusal({ ...base, from: "admin", to: "member", adminCount: 0 })).toBe("lastAdmin");
  });

  it("refuses an unknown role and a role they already have", () => {
    expect(roleChangeRefusal({ ...base, to: "system" })).toBe("unknownRole");
    expect(roleChangeRefusal({ ...base, to: "owner" })).toBe("unknownRole");
    expect(roleChangeRefusal({ ...base, from: "support", to: "support" })).toBe("unchanged");
  });

  it("lets the system (no actor) change anyone", () => {
    expect(roleChangeRefusal({ ...base, actorId: null })).toBeNull();
  });
});

describe("disableRefusal", () => {
  const base = { actorId: "a", targetId: "t", targetRole: "member", adminCount: 1 };

  it("allows disabling someone else", () => {
    expect(disableRefusal(base)).toBeNull();
    expect(disableRefusal({ ...base, targetRole: "admin", adminCount: 2 })).toBeNull();
  });

  it("refuses yourself and the last admin", () => {
    expect(disableRefusal({ ...base, targetId: "a" })).toBe("self");
    expect(disableRefusal({ ...base, targetRole: "admin", adminCount: 1 })).toBe("lastAdmin");
  });
});

describe("staffReasonZSchema", () => {
  it("takes 1–500 characters, trimmed", () => {
    expect(staffReasonZSchema.parse("  Lost phone  ")).toBe("Lost phone");
    expect(staffReasonZSchema.safeParse("   ").success).toBe(false);
    expect(staffReasonZSchema.safeParse("x".repeat(500)).success).toBe(true);
    expect(staffReasonZSchema.safeParse("x".repeat(501)).success).toBe(false);
  });
});
