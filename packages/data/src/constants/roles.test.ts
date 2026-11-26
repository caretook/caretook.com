import { describe, expect, it } from "vitest";
import {
  EASY_ROLE_NAMES,
  GROUP_MANAGER_ROLES,
  GROUP_ROLE_NAMES,
  GROUP_ROLES,
  LOGGER_ROLES,
  WRITER_ROLES,
  groupRoleLabel,
  hasGroupRole,
  isEasyRole,
  isLoggerRole,
  isOwnRowLogger,
  isWriterRole,
} from "./roles";

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
