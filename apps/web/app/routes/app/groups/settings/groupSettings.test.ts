import { describe, expect, it } from "vitest";
import {
  groupSettingsAccess,
  memberAccess,
  memberName,
  parseGroupName,
  parseRecipientTimeZone,
  parseSimpleTilesChoice,
  roleLabel,
  sortMembers,
  timeZoneLabel,
  timeZoneOptions,
} from "./groupSettings";

const GROUP = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";

describe("groupSettingsAccess", () => {
  it("lets owners and admins rename the group and edit the recipient", () => {
    for (const role of ["owner", "admin"]) {
      expect(groupSettingsAccess(GROUP, role)).toEqual({ renameGroup: true, editRecipient: true });
    }
  });
  it("lets caretakers edit the recipient only", () => {
    expect(groupSettingsAccess(GROUP, "caretaker")).toEqual({ renameGroup: false, editRecipient: true });
  });
  it("gives viewers, and anyone without a role, nothing to edit", () => {
    expect(groupSettingsAccess(GROUP, "viewer")).toEqual({ renameGroup: false, editRecipient: false });
    expect(groupSettingsAccess(GROUP, null)).toEqual({ renameGroup: false, editRecipient: false });
  });
});

describe("parseGroupName", () => {
  it("trims a name", () => {
    expect(parseGroupName({ name: "  The Example Family " })).toEqual({
      ok: true,
      data: { name: "The Example Family" },
    });
  });
  it("refuses an empty or blank name with the field's error", () => {
    for (const name of ["", "   "]) {
      expect(parseGroupName({ name })).toMatchObject({
        ok: false,
        issues: [{ path: "name", message: "Enter a name." }],
      });
    }
  });
  it("refuses a name over 120 characters", () => {
    expect(parseGroupName({ name: "x".repeat(121) })).toMatchObject({
      ok: false,
      issues: [{ path: "name", message: "Use 120 characters or fewer." }],
    });
  });
});

describe("parseRecipientTimeZone", () => {
  it("keeps a known zone", () => {
    expect(parseRecipientTimeZone({ timeZone: " America/New_York " })).toEqual({
      ok: true,
      data: { timeZone: "America/New_York" },
    });
  });
  it("leaves an empty zone out, so the stored one stays", () => {
    expect(parseRecipientTimeZone({ timeZone: "" })).toEqual({ ok: true, data: {} });
  });
  it("refuses an unknown zone with the field's error", () => {
    expect(parseRecipientTimeZone({ timeZone: "Mars/Olympus_Mons" })).toMatchObject({
      ok: false,
      issues: [{ path: "timeZone", message: "Choose a time zone from the list." }],
    });
  });
});

describe("timeZoneOptions", () => {
  it("sorts the supported zones and adds the current and device zones when missing", () => {
    expect(timeZoneOptions("UTC", "Europe/Paris", ["America/New_York", "America/Los_Angeles"])).toEqual([
      "America/Los_Angeles",
      "America/New_York",
      "Europe/Paris",
      "UTC",
    ]);
  });
  it("lists each zone once", () => {
    expect(timeZoneOptions("America/New_York", "America/New_York", ["America/New_York"])).toEqual([
      "America/New_York",
    ]);
  });
  it("labels a zone without underscores", () => {
    expect(timeZoneLabel("America/Los_Angeles")).toBe("America/Los Angeles");
  });
});

describe("memberAccess", () => {
  const ALL = ["owner", "admin", "caretaker", "viewer"];
  const BELOW_OWNER = ["admin", "caretaker", "viewer"];
  const access = (actorRole: string | null, memberRole: string, isSelf = false) =>
    memberAccess({ actorRole, memberRole, isSelf });

  it("lets an owner give anyone any role, and remove anyone else", () => {
    for (const memberRole of ALL) {
      expect(access("owner", memberRole)).toEqual({
        roles: ALL,
        remove: true,
        leave: false,
        simpleMode: true,
        lock: true,
      });
    }
  });
  it("lets an owner change their own role and leave (the server refuses the last owner)", () => {
    expect(access("owner", "owner", true)).toEqual({
      roles: ALL,
      remove: false,
      leave: true,
      simpleMode: true,
      // Nobody locks themselves.
      lock: false,
    });
  });
  it("lets an admin change and remove members below owner, without offering owner", () => {
    for (const memberRole of BELOW_OWNER) {
      expect(access("admin", memberRole)).toEqual({
        roles: BELOW_OWNER,
        remove: true,
        leave: false,
        simpleMode: true,
        lock: true,
      });
    }
    expect(access("admin", "admin", true)).toEqual({
      roles: BELOW_OWNER,
      remove: false,
      leave: true,
      simpleMode: true,
      lock: false,
    });
  });
  it("gives an admin nothing to do to an owner", () => {
    expect(access("admin", "owner")).toEqual({
      roles: [],
      remove: false,
      leave: false,
      simpleMode: false,
      lock: false,
    });
  });
  it("lets caretakers, viewers and anyone without a role only leave", () => {
    for (const actorRole of ["caretaker", "viewer", null]) {
      for (const memberRole of ALL) {
        expect(access(actorRole, memberRole)).toEqual({
          roles: [],
          remove: false,
          leave: false,
          simpleMode: false,
          lock: false,
        });
      }
      expect(access(actorRole, "viewer", true)).toEqual({
        roles: [],
        remove: false,
        leave: true,
        simpleMode: false,
        lock: false,
      });
    }
  });
});

describe("sortMembers", () => {
  it("orders by role, owners first, then by name, without changing its input", () => {
    const members = [
      { role: "viewer", name: "Vic" },
      { role: "caretaker", name: null },
      { role: "owner", name: "Olu" },
      { role: "caretaker", name: "Cam" },
      { role: "guest", name: "Gus" },
      { role: "admin", name: "Ada" },
      { role: "caretaker", name: "Bea" },
    ];
    const before = [...members];
    expect(sortMembers(members).map((m) => m.name)).toEqual(["Olu", "Ada", "Bea", "Cam", null, "Vic", "Gus"]);
    expect(members).toEqual(before);
  });
});

describe("roleLabel and memberName", () => {
  it("names the known roles, and shows an unknown one as it is", () => {
    expect(["owner", "admin", "caretaker", "viewer"].map(roleLabel)).toEqual([
      "Owner",
      "Admin",
      "Caretaker",
      "Viewer",
    ]);
    expect(roleLabel("guest")).toBe("guest");
    expect(roleLabel(null)).toBe("Member");
  });
  it("falls back to Member for a missing or blank name", () => {
    expect(memberName(" Sam Example ")).toBe("Sam Example");
    expect(memberName("  ")).toBe("Member");
    expect(memberName(null)).toBe("Member");
  });
});

describe("parseSimpleTilesChoice", () => {
  const four = ["symptom", "vital:bloodGlucose", "dose", "note"];
  it("takes learned, fixed, or four different tiles", () => {
    expect(parseSimpleTilesChoice({ mode: "learned", tiles: four })).toEqual({
      ok: true,
      data: { simpleTiles: { mode: "learned" } },
    });
    expect(parseSimpleTilesChoice({ mode: "fixed", tiles: [] })).toEqual({
      ok: true,
      data: { simpleTiles: { mode: "fixed" } },
    });
    expect(parseSimpleTilesChoice({ mode: "custom", tiles: four })).toEqual({
      ok: true,
      data: {
        simpleTiles: {
          mode: "custom",
          tiles: [
            { kind: "symptom" },
            { kind: "vital", vitalType: "bloodGlucose" },
            { kind: "dose" },
            { kind: "note" },
          ],
        },
      },
    });
  });

  it("refuses fewer than four, repeats, unknown tiles and unknown modes", () => {
    const error = (mode: string, tiles: string[]) => {
      const parsed = parseSimpleTilesChoice({ mode, tiles });
      return parsed.ok ? null : parsed.error;
    };
    expect(error("custom", ["note", "dose", "symptom"])).toBe("Pick four tiles.");
    expect(error("custom", ["note", "dose", "symptom", "vital:mood"])).toBe("Pick four tiles.");
    expect(error("custom", ["note", "dose", "symptom", "note"])).toBe("Pick four different tiles.");
    expect(error("sometimes", four)).toBe("Choose how the tiles are picked.");
  });
});
