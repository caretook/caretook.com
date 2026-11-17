import type { AuthUser } from "../src/permissions";

import { randomUUID } from "node:crypto";
import { SYSTEM_USER } from "../src/constants";
import { isError } from "../src/errors";
import { careGroupMemberService, careGroupService, userService } from "../src/services";

export const system = { authUser: SYSTEM_USER };

/** Unwrap a returned AppError into a thrown one, for fixture setup only. */
export const ok = <T>(value: T): Exclude<T, { code: unknown; isTSError?: unknown } & Error> => {
  if (isError(value)) throw new Error(`Fixture failed: ${String(value.code)}`, { cause: value });
  return value as never;
};

/** A new member account with a unique @example.com email. */
export const createUser = async (label: string, role: "admin" | "member" = "member") => {
  const email = `${label}-${randomUUID().slice(0, 8)}@example.com`;
  const user = ok(await userService.create(system, { email, name: label, role }));
  if (!user) throw new Error("Fixture failed: user not readable");
  const authUser: AuthUser = { id: user.id, roleNames: user.roleNames };
  return { user, ctx: { authUser } };
};

/** A group owned by `owner`, with the other users added under the given roles. */
export const createGroup = async (
  owner: { ctx: { authUser: AuthUser } },
  members: { user: { id: string }; role: "admin" | "caretaker" | "viewer" | "owner" }[] = [],
) => {
  const { group, recipient } = ok(
    await careGroupService.create(owner.ctx, { name: "Test Family", recipient: { name: "Pat Example" } }),
  );
  if (!group || !recipient) throw new Error("Fixture failed: group not readable");
  for (const m of members) {
    ok(await careGroupMemberService.create(system, { groupId: group.id, userId: m.user.id, role: m.role }));
  }
  return { group, recipient };
};
