import { describe, expect, it } from "vitest";
import { LINK_ROLES } from "../db/schema/care-groups/inviteRules";
import { STAFF_SETTABLE_GROUP_ROLES } from "../domain/admin/groupAdminRules";
import {
  TODO_COMPLETER_ROLES as DOMAIN_TODO_COMPLETER_ROLES,
  isTodoCompleter,
} from "../domain/todos/todoRules";
import {
  EASY_ROLE_NAMES,
  GROUP_MANAGER_ROLES,
  GROUP_ROLE_CAPABILITIES,
  GROUP_ROLE_NAMES,
  GROUP_ROLES,
  LOGGER_ROLES,
  OWNER_ROLES,
  TODO_COMPLETER_ROLES,
  WRITER_ROLES,
  completesOnlyAssigned,
  groupRoleLabel,
  hasGroupRole,
  isEasyRole,
  isLoggerRole,
  isOwnRowLogger,
  isOwnerRole,
  isWriterRole,
} from "./roles";

/** The roles the capability table marks for `capability`, in role order. */
const marked = (capability: keyof (typeof GROUP_ROLE_CAPABILITIES)[keyof typeof GROUP_ROLE_CAPABILITIES]) =>
  GROUP_ROLE_NAMES.filter((role) => GROUP_ROLE_CAPABILITIES[role][capability]);

describe("the group roles", () => {
  it("are six, each with a label, a picker group, a description and what it sees and changes, in picker order", () => {
    expect(GROUP_ROLES.map((r) => r.name)).toEqual([...GROUP_ROLE_NAMES]);
    expect(GROUP_ROLES.map((r) => [r.label, r.group])).toEqual([
      ["Owner", "regular"],
      ["Admin", "regular"],
      ["Caretaker", "regular"],
      ["Viewer", "regular"],
      ["Easy helper", "easier"],
      ["Easy viewer", "easier"],
    ]);
    for (const role of GROUP_ROLES)
      for (const words of [role.description, role.sees, role.changes])
        expect(words.length).toBeGreaterThan(0);
  });

  it("say who the easy roles are for only in their descriptions, never in their names", () => {
    for (const role of GROUP_ROLES.filter((r) => r.group === "easier")) {
      expect(role.description).toMatch(/^For someone who isn't comfortable with apps/);
      expect(`${role.name} ${role.label}`).not.toMatch(/memory|thinking|apps/i);
    }
  });

  it("label a role, and an unknown one as it is", () => {
    expect(groupRoleLabel("easy_helper")).toBe("Easy helper");
    expect(groupRoleLabel("guest")).toBe("guest");
  });
});

describe("the role sets", () => {
  it("are one source: writers, loggers (writers and an Easy helper), the easy roles and managers", () => {
    expect(WRITER_ROLES).toEqual(["owner", "admin", "caretaker"]);
    expect(LOGGER_ROLES).toEqual(["owner", "admin", "caretaker", "easy_helper"]);
    expect(EASY_ROLE_NAMES).toEqual(["easy_helper", "easy_viewer"]);
    expect(GROUP_MANAGER_ROLES).toEqual(["owner", "admin"]);
  });

  it.each([
    ["owner", { writer: true, logger: true, easy: false, ownRows: false }],
    ["admin", { writer: true, logger: true, easy: false, ownRows: false }],
    ["caretaker", { writer: true, logger: true, easy: false, ownRows: false }],
    ["viewer", { writer: false, logger: false, easy: false, ownRows: false }],
    ["easy_helper", { writer: false, logger: true, easy: true, ownRows: true }],
    ["easy_viewer", { writer: false, logger: false, easy: true, ownRows: false }],
    ["superuser", { writer: false, logger: false, easy: false, ownRows: false }],
    [null, { writer: false, logger: false, easy: false, ownRows: false }],
  ] as const)("%s", (role, expected) => {
    expect({
      writer: isWriterRole(role),
      logger: isLoggerRole(role),
      easy: isEasyRole(role),
      ownRows: isOwnRowLogger(role),
    }).toEqual(expected);
  });

  it("checks membership of any set, false for null", () => {
    expect(hasGroupRole(["viewer"], "viewer")).toBe(true);
    expect(hasGroupRole(["viewer"], undefined)).toBe(false);
  });
});

describe("the capability table", () => {
  it("has a row for every role, and every row names every capability", () => {
    expect(Object.keys(GROUP_ROLE_CAPABILITIES)).toEqual([...GROUP_ROLE_NAMES]);
    const capabilities = Object.keys(GROUP_ROLE_CAPABILITIES.owner).sort();
    for (const role of GROUP_ROLE_NAMES) {
      expect(Object.keys(GROUP_ROLE_CAPABILITIES[role]).sort()).toEqual(capabilities);
      for (const allowed of Object.values(GROUP_ROLE_CAPABILITIES[role]))
        expect(typeof allowed).toBe("boolean");
    }
  });

  it.each([
    ["write", WRITER_ROLES],
    ["log", LOGGER_ROLES],
    ["manage", GROUP_MANAGER_ROLES],
    ["own", OWNER_ROLES],
    ["easyView", EASY_ROLE_NAMES],
    ["completeAssignedOnly", TODO_COMPLETER_ROLES],
    ["linkInvitable", LINK_ROLES],
    ["staffSettable", STAFF_SETTABLE_GROUP_ROLES],
  ] as const)("marks %s for exactly its set's roles", (capability, set) => {
    expect([...set]).toEqual(marked(capability));
  });

  it("gives the todo rules the role module's completers", () => {
    expect(DOMAIN_TODO_COMPLETER_ROLES).toBe(TODO_COMPLETER_ROLES);
    expect(isTodoCompleter).toBe(completesOnlyAssigned);
  });

  it("names the owner and the todo completers", () => {
    expect(GROUP_ROLE_NAMES.filter(isOwnerRole)).toEqual(["owner"]);
    expect(GROUP_ROLE_NAMES.filter(completesOnlyAssigned)).toEqual(["viewer", "easy_helper", "easy_viewer"]);
  });

  it.each([...GROUP_ROLE_NAMES, "superuser", null] as const)(
    "%s is an owner and completes only assigned todos exactly as the table says",
    (role) => {
      const row = role && role !== "superuser" ? GROUP_ROLE_CAPABILITIES[role] : undefined;
      expect(isOwnerRole(role)).toBe(row?.own ?? false);
      expect(completesOnlyAssigned(role)).toBe(row?.completeAssignedOnly ?? false);
    },
  );
});
