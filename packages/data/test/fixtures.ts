import type { GroupRoleName } from "../src/constants";
import type { AuthUser } from "../src/permissions";

import { randomUUID } from "node:crypto";
import * as Y from "yjs";
import { SYSTEM_USER } from "../src/constants";
import { isError } from "../src/errors";
import { careGroupMemberService, careGroupService, userService } from "../src/services";
import { NOTE_FRAGMENT, toBase64 } from "../src/domain/live-notes/noteYjs";

export const system = { authUser: SYSTEM_USER };

/** Unwrap a returned AppError into a thrown one, for fixture setup only. */
export const ok = <T>(value: T): Exclude<T, { code: unknown; isTSError?: unknown } & Error> => {
  if (isError(value)) throw new Error(`Fixture failed: ${String(value.code)}`, { cause: value });
  return value as never;
};

/** A new member account with a unique @example.com email. */
export const createUser = async (label: string, role: "admin" | "support" | "member" = "member") => {
  const email = `${label}-${randomUUID().slice(0, 8)}@example.com`;
  const user = ok(await userService.create(system, { email, name: label, role }));
  if (!user) throw new Error("Fixture failed: user not readable");
  const authUser: AuthUser = { id: user.id, roleNames: user.roleNames };
  return { user, ctx: { authUser } };
};

/** A group owned by `owner`, with the other users added under the given roles. */
export const createGroup = async (
  owner: { ctx: { authUser: AuthUser } },
  members: { user: { id: string }; role: GroupRoleName }[] = [],
) => {
  const { group, recipient } = ok(
    await careGroupService.create(owner.ctx, {
      name: "Test Family",
      recipient: { name: "Pat Example", timeZone: "America/Los_Angeles" },
    }),
  );
  if (!group || !recipient) throw new Error("Fixture failed: group not readable");
  for (const m of members) {
    ok(await careGroupMemberService.create(system, { groupId: group.id, userId: m.user.id, role: m.role }));
  }
  return { group, recipient };
};

/** A member's role in a world, besides its owner (a second owner is the test's own). */
export type WorldMemberRole = Exclude<GroupRoleName, "owner">;
/** An account outside the group: `outsider` (a member account) or `staff` (Caretook staff). */
export type WorldExtra = "outsider" | "staff";
export type WorldUser = Awaited<ReturnType<typeof createUser>>;

const DEFAULT_MEMBERS = ["admin", "caretaker", "viewer"] as const;

/**
 * A care group as most server tests need it: one call builds the owner, the
 * members by role, any accounts outside the group, the group and its care
 * recipient (with the default medication passes every group gets).
 *
 * - `members`: the roles to add besides the owner, one user each, in order
 *   (default admin, caretaker, viewer); easy roles too. A role listed
 *   twice is an error; a second owner is the test's own (`createUser`, then
 *   `careGroupMemberService.create` as the system).
 * - `extras`: `outsider` (a member account in no group) and `staff` (a
 *   Caretook staff account, `admin` globally, in no group). Default none.
 * - `names`: a user's display name, by key (default the key itself, as
 *   tests that read names expect: `owner`, `caretaker`, …).
 *
 * Returns `u` (every user by key: `owner`, each member role, each extra;
 * each `{ user, ctx }` as `createUser` makes them), `group`, `groupId`,
 * `recipient`, and `membershipOf(who)`, the care_group_member row of a user
 * (read as the system; throws when there is none).
 *
 * Users get unique emails, so worlds never collide across tests or workers.
 * Build one per test; anything more (medications, providers, settings) is
 * the test's own.
 */
export const createWorld = async <
  const M extends readonly WorldMemberRole[] = typeof DEFAULT_MEMBERS,
  const X extends readonly WorldExtra[] = readonly [],
>(
  options: { members?: M; extras?: X; names?: Partial<Record<"owner" | M[number] | X[number], string>> } = {},
) => {
  const members = (options.members ?? DEFAULT_MEMBERS) as readonly M[number][];
  const extras = options.extras ?? ([] as unknown as X);
  if (new Set(members).size !== members.length) throw new Error("Fixture failed: a role listed twice");
  const names: Partial<Record<string, string>> = options.names ?? {};
  const label = (key: string) => names[key] ?? key;

  const u = { owner: await createUser(label("owner")) } as Record<string, WorldUser>;
  for (const role of members) u[role] = await createUser(label(role));
  for (const extra of extras)
    u[extra] = await createUser(label(extra), extra === "staff" ? "admin" : "member");
  const { group, recipient } = await createGroup(
    u.owner!,
    members.map((role) => ({ user: u[role]!.user, role })),
  );

  const membershipOf = async (who: { user: { id: string } }) => {
    const m = ok(
      await careGroupMemberService.get(system, {
        filter: { groupId: { type: "eq", value: group.id }, userId: { type: "eq", value: who.user.id } },
      }),
    );
    if (!m) throw new Error("Fixture failed: no membership");
    return m;
  };

  return {
    u: u as Record<"owner" | M[number] | X[number], WorldUser>,
    group,
    groupId: group.id,
    recipient,
    membershipOf,
  };
};

export type World = Awaited<ReturnType<typeof createWorld>>;

/**
 * One device's edit to a live document: a Yjs update (base64) that appends
 * a paragraph to `doc`, shaped like the Tiptap editor's content.
 */
export const typeParagraph = (doc: Y.Doc, text: string) => {
  let update: Uint8Array | null = null;
  const capture = (u: Uint8Array) => (update = u);
  doc.on("update", capture);
  const p = new Y.XmlElement("paragraph");
  const t = new Y.XmlText();
  p.insert(0, [t]);
  t.insert(0, text);
  const root = doc.getXmlFragment(NOTE_FRAGMENT);
  root.insert(root.length, [p]);
  doc.off("update", capture);
  if (!update) throw new Error("Fixture failed: no update");
  return toBase64(update);
};

/** A fresh Yjs document, for `typeParagraph`. */
export const newYDoc = () => new Y.Doc();
