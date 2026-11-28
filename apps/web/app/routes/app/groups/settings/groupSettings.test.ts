import { describe, expect, it } from "vitest";
import {
  groupSettingsAccess,
  memberAccess,
  memberName,
  parseGroupName,
  parseRecipientTimeZone,
  parseEasyTilesChoice,
  roleDescription,
  roleGroups,
  roleLabel,
  sortMembers,
  symptomCatalogAccess,
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

describe("symptomCatalogAccess", () => {
  it("lets writers archive, and only owners replace", () => {
    expect(symptomCatalogAccess(GROUP, "owner")).toEqual({ archive: true, replace: true });
    for (const role of ["admin", "caretaker"]) {
      expect(symptomCatalogAccess(GROUP, role)).toEqual({ archive: true, replace: false });
    }
  });
  it("gives every other role, an unknown one and no role nothing", () => {
    for (const role of ["viewer", "easy_helper", "easy_viewer", "someone", null, undefined]) {
      expect(symptomCatalogAccess(GROUP, role)).toEqual({ archive: false, replace: false });
    }
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
  const ALL = ["owner", "admin", "caretaker", "viewer", "easy_helper", "easy_viewer"];
  const BELOW_OWNER = ["admin", "caretaker", "viewer", "easy_helper", "easy_viewer"];
  const access = (actorRole: string | null, memberRole: string, isSelf = false) =>
    memberAccess({ actorRole, memberRole, isSelf });

  it("lets an owner give anyone any role, and remove anyone else", () => {
    for (const memberRole of ALL) {
      expect(access("owner", memberRole)).toEqual({
        roles: ALL,
        remove: true,
        leave: false,
      });
    }
  });
  it("lets an owner change their own role and leave (the server refuses the last owner)", () => {
    expect(access("owner", "owner", true)).toEqual({
      roles: ALL,
      remove: false,
      leave: true,
    });
  });
  it("lets an admin change and remove members below owner, without offering owner", () => {
    for (const memberRole of BELOW_OWNER) {
      expect(access("admin", memberRole)).toEqual({
        roles: BELOW_OWNER,
        remove: true,
        leave: false,
      });
    }
    expect(access("admin", "admin", true)).toEqual({
      roles: BELOW_OWNER,
      remove: false,
      leave: true,
    });
  });
  it("gives an admin nothing to do to an owner", () => {
    expect(access("admin", "owner")).toEqual({
      roles: [],
      remove: false,
      leave: false,
    });
  });
  it("gives the Easy roles and an unknown role no roles to give", () => {
    for (const actorRole of ["easy_helper", "easy_viewer", "someone"]) {
      for (const memberRole of ALL) expect(access(actorRole, memberRole).roles).toEqual([]);
    }
  });
  it("lets caretakers, viewers and anyone without a role only leave", () => {
    for (const actorRole of ["caretaker", "viewer", null]) {
      for (const memberRole of ALL) {
        expect(access(actorRole, memberRole)).toEqual({
          roles: [],
          remove: false,
          leave: false,
        });
      }
      expect(access(actorRole, "viewer", true)).toEqual({
        roles: [],
        remove: false,
        leave: true,
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

describe("roleGroups and roleDescription", () => {
  it("groups a picker's roles: the regular ones, then the easy ones under Easier to use", () => {
    expect(roleGroups(["admin", "caretaker", "viewer", "easy_helper", "easy_viewer"])).toEqual([
      { id: "regular", label: "Regular roles", roles: ["admin", "caretaker", "viewer"] },
      { id: "easier", label: "Easier to use", roles: ["easy_helper", "easy_viewer"] },
    ]);
  });

  it("leaves out an empty group and roles this build doesn't know", () => {
    expect(roleGroups(["caretaker", "guest"])).toEqual([
      { id: "regular", label: "Regular roles", roles: ["caretaker"] },
    ]);
    expect(roleGroups([])).toEqual([]);
  });

  it("describes each role from GROUP_ROLES, who the easy ones are for included", () => {
    expect(roleDescription("viewer")).toBe(
      "Sees care information but can't change it, apart from ticking off todos assigned to them.",
    );
    expect(roleDescription("easy_helper")).toMatch(
      /^For someone who isn't comfortable with apps or who has memory or thinking difficulties\./,
    );
    expect(roleDescription("guest")).toBe("");
  });
});

describe("roleLabel and memberName", () => {
  it("names the known roles, and shows an unknown one as it is", () => {
    expect(["owner", "admin", "caretaker", "viewer", "easy_helper", "easy_viewer"].map(roleLabel)).toEqual([
      "Owner",
      "Admin",
      "Caretaker",
      "Viewer",
      "Easy helper",
      "Easy viewer",
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

describe("parseEasyTilesChoice", () => {
  const four = ["symptom", "vital:bloodGlucose", "dose", "note"];
  it("takes learned, fixed, or four different tiles", () => {
    expect(parseEasyTilesChoice({ mode: "learned", tiles: four })).toEqual({
      ok: true,
      data: { easyTiles: { mode: "learned" } },
    });
    expect(parseEasyTilesChoice({ mode: "fixed", tiles: [] })).toEqual({
      ok: true,
      data: { easyTiles: { mode: "fixed" } },
    });
    expect(parseEasyTilesChoice({ mode: "custom", tiles: four })).toEqual({
      ok: true,
      data: {
        easyTiles: {
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
      const parsed = parseEasyTilesChoice({ mode, tiles });
      return parsed.ok ? null : parsed.error;
    };
    expect(error("custom", ["note", "dose", "symptom"])).toBe("Pick four tiles.");
    expect(error("custom", ["note", "dose", "symptom", "vital:mood"])).toBe("Pick four tiles.");
    expect(error("custom", ["note", "dose", "symptom", "note"])).toBe("Pick four different tiles.");
    expect(error("sometimes", four)).toBe("Choose how the tiles are picked.");
  });
});
