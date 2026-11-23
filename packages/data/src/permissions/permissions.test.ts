import type { AuthUser } from "./types";

import { describe, expect, it } from "vitest";
import { SYSTEM_USER } from "../constants";
import { isError } from "../errors";
import { is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import * as schema from "../db/schema";
import { PERMISSIONS, getPermissionScope, getUnauthorizedFields, hasPermission } from "./permissions";

const member: AuthUser = { id: "u-member", roleNames: ["member"] };
const staff: AuthUser = { id: "u-staff", roleNames: ["admin"] };

describe("getPermissionScope", () => {
  it("gives the system unrestricted access everywhere", () => {
    expect(getPermissionScope("careRecipientSchema", "update", SYSTEM_USER)).toEqual({ type: "all" });
  });

  it("rejects unauthenticated callers with a 401 code", () => {
    const scope = getPermissionScope("userSchema", "read", null);
    expect(isError(scope) && scope.code).toBe("permissions:unauthenticated");
  });

  it("scopes a member's user reads to themselves OR co-members' public profiles", () => {
    expect(getPermissionScope("userSchema", "read", member)).toEqual({
      type: "rules",
      rules: [
        { type: "owned", field: "id", userId: "u-member" },
        {
          type: "groupUser",
          field: "id",
          userId: "u-member",
          groupRoles: ["owner", "admin", "caretaker", "viewer", "easy_helper", "easy_viewer"],
          fields: ["id", "name", "image", "avatarColor", "avatarIcon"],
        },
      ],
    });
  });

  it("gives staff all users, but only membership-based access to care data", () => {
    expect(getPermissionScope("userSchema", "list", staff)).toEqual({ type: "all" });
    expect(getPermissionScope("careRecipientSchema", "read", staff)).toEqual({
      type: "rules",
      rules: [
        {
          type: "group",
          field: "groupId",
          userId: "u-staff",
          groupRoles: ["owner", "admin", "caretaker", "viewer", "easy_helper", "easy_viewer"],
        },
      ],
    });
  });

  it("limits recipient updates to writers and group deletes to owners", () => {
    const update = getPermissionScope("careRecipientSchema", "update", member);
    const remove = getPermissionScope("careGroupSchema", "delete", member);
    expect(!isError(update) && update.type === "rules" && update.rules[0]).toMatchObject({
      groupRoles: ["owner", "admin", "caretaker"],
    });
    expect(!isError(remove) && remove.type === "rules" && remove.rules[0]).toMatchObject({
      field: "id",
      groupRoles: ["owner"],
    });
  });

  it("lets members delete their own membership (leave) or manage others'", () => {
    const scope = getPermissionScope("careGroupMemberSchema", "delete", member);
    expect(!isError(scope) && scope.type === "rules" && scope.rules.map((r) => r.type)).toEqual([
      "owned",
      "group",
    ]);
  });

  it("adds a groupOwn rule (created_by) for an Easy helper's entry updates and deletes", () => {
    for (const permission of ["update", "delete"] as const)
      expect(getPermissionScope("timelineEntrySchema", permission, member)).toEqual({
        type: "rules",
        rules: [
          {
            type: "group",
            field: "groupId",
            userId: "u-member",
            groupRoles: ["owner", "admin", "caretaker"],
          },
          {
            type: "groupOwn",
            field: "groupId",
            ownerField: "createdBy",
            userId: "u-member",
            groupRoles: ["easy_helper"],
          },
        ],
      });
    expect(getPermissionScope("timelineEntrySchema", "create", member)).toEqual({
      type: "rules",
      rules: [
        {
          type: "group",
          field: "groupId",
          userId: "u-member",
          groupRoles: ["owner", "admin", "caretaker", "easy_helper"],
        },
      ],
    });
  });

  it("lets any signed-in user create a group", () => {
    expect(getPermissionScope("careGroupSchema", "create", member)).toEqual({ type: "all" });
    expect(isError(getPermissionScope("careGroupSchema", "create", null))).toBe(true);
  });
});

describe("getUnauthorizedFields", () => {
  it("blocks members from escalating their global role", () => {
    expect(
      getUnauthorizedFields({
        schemaName: "userSchema",
        permission: "update",
        authUser: member,
        data: { name: "New", role: "admin" },
      }),
    ).toEqual(["role"]);
  });

  it("ignores restricted fields that are undefined", () => {
    expect(
      getUnauthorizedFields({
        schemaName: "userSchema",
        permission: "update",
        authUser: member,
        data: { name: "New", role: undefined },
      }),
    ).toEqual([]);
  });

  it("keeps membership group/user ids system-only on update", () => {
    expect(
      getUnauthorizedFields({
        schemaName: "careGroupMemberSchema",
        permission: "update",
        authUser: staff,
        data: { role: "viewer", groupId: "g2", userId: "u2" },
      }),
    ).toEqual(["groupId", "userId"]);
  });
});

describe("hasPermission", () => {
  const withGroups: AuthUser = { ...member, groupRoles: { g1: "caretaker", g2: "viewer" } };

  it("decides group rules from authUser.groupRoles", () => {
    const can = (groupId: string) =>
      hasPermission({
        authUser: withGroups,
        schemaName: "careRecipientSchema",
        permission: "update",
        target: { groupId },
      });
    expect(can("g1")).toBe(true);
    expect(can("g2")).toBe(false);
    expect(can("g3")).toBe(false);
  });

  it("decides owned rules from the target", () => {
    const args = { authUser: member, schemaName: "userSchema", permission: "update" } as const;
    expect(hasPermission({ ...args, target: { id: "u-member" } })).toBe(true);
    expect(hasPermission({ ...args, target: { id: "someone-else" } })).toBe(false);
  });

  it("decides groupOwn rules from the role and the target's creator", () => {
    const can = (role: "caretaker" | "viewer" | "easy_helper" | "easy_viewer", createdBy: string) =>
      hasPermission({
        authUser: { ...member, groupRoles: { g1: role } },
        schemaName: "timelineEntrySchema",
        permission: "update",
        target: { groupId: "g1", createdBy },
      });
    expect(can("caretaker", "someone-else")).toBe(true);
    expect(can("easy_helper", "u-member")).toBe(true);
    expect(can("easy_helper", "someone-else")).toBe(false);
    expect(can("easy_viewer", "u-member")).toBe(false);
    expect(can("viewer", "u-member")).toBe(false);
    // Their own row in another group they're not in grants nothing.
    expect(
      hasPermission({
        authUser: { ...member, groupRoles: { g1: "easy_helper" } },
        schemaName: "timelineEntrySchema",
        permission: "delete",
        target: { groupId: "g2", createdBy: "u-member" },
      }),
    ).toBe(false);
  });

  it("is false without a target unless access is unrestricted", () => {
    expect(hasPermission({ authUser: member, schemaName: "userSchema", permission: "read" })).toBe(false);
    expect(hasPermission({ authUser: staff, schemaName: "userSchema", permission: "read" })).toBe(true);
  });
});

describe("PERMISSIONS", () => {
  it("has an entry for every table the schema exports, and for nothing else", () => {
    const tables = Object.entries(schema)
      .filter(([, value]) => is(value, PgTable))
      .map(([name]) => name)
      .sort();
    expect(tables.length).toBeGreaterThan(20);
    expect(Object.keys(PERMISSIONS).sort()).toEqual(tables);
  });
});
