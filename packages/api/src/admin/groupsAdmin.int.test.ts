import type { AuthUser } from "@caretook/data";

import {
  adminAuditLogModel,
  careGroupMemberModel,
  careGroupService,
  carePeriodSchema,
  careRecipientDetailsSchema,
  careRecipientSchema,
  getDb,
  isError,
  medicationSchema,
  medicationService,
  noteDocumentSchema,
  providerSchema,
  providerService,
  SYSTEM_USER,
  timelineEntrySchema,
  timelineEntryService,
} from "@caretook/data";
import { setBackgroundRunner } from "@caretook/notifications";
import { createRouterClient, ORPCError } from "@orpc/server";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createUser, ok } from "../../../data/test/fixtures";
import { router } from "..";

// Care groups in /admin (admin slice 4): admin.groups.* for admin, support
// and members. Reads carry no care data; every admin write records one audit
// entry in its own transaction, and a group always keeps an owner.

const system = { authUser: SYSTEM_USER };
const clientFor = (authUser: AuthUser | null) => createRouterClient(router, { context: { authUser } });

const pending: Promise<unknown>[] = [];
beforeAll(() => setBackgroundRunner((work) => void pending.push(work)));
afterAll(() => setBackgroundRunner(null));

const codeOf = async (call: Promise<unknown>) => {
  try {
    await call;
    return "ok";
  } catch (e) {
    if (e instanceof ORPCError)
      return `${e.code}:${String((e.data as { code?: string } | undefined)?.code ?? "")}`;
    throw e;
  }
};

const staff = async (role: "admin" | "support") => {
  const who = await createUser(`grp-${role}`, role);
  return { ...who, api: clientFor(who.ctx.authUser) };
};

/** Every audit entry about `groupId` with `action`. */
const auditFor = async (groupId: string, action: string) => {
  const res = await adminAuditLogModel.search({
    authUser: SYSTEM_USER,
    filter: { target: groupId },
    paginate: { page: 1, limit: 500 },
  });
  if (isError(res)) throw new Error(String(res.code));
  return res.data.filter((e) => e.action === action);
};

const roleOf = (groupId: string, userId: string) => careGroupMemberModel.getRole(groupId, userId);

/** Every key in `value`, at any depth. */
const keysOf = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.flatMap(keysOf)
    : value && typeof value === "object"
      ? Object.entries(value).flatMap(([key, v]) => [key, ...keysOf(v)])
      : [];

/** A group named with `tag`: an owner, a caretaker and a viewer. */
const tagged = async (tag: string) => {
  const owner = await createUser(`${tag}-owner`);
  const caretaker = await createUser(`${tag}-caretaker`);
  const viewer = await createUser(`${tag}-viewer`);
  const { group, recipient } = ok(
    await careGroupService.create(owner.ctx, {
      name: `${tag} Family`,
      recipient: { name: `${tag} Recipient`, preferredName: `Nana ${tag}`, timeZone: "America/Los_Angeles" },
    }),
  );
  if (!group || !recipient) throw new Error("no group");
  ok(
    await careGroupMemberModel.create({
      ...system,
      data: { groupId: group.id, userId: caretaker.user.id, role: "caretaker", invitedBy: owner.user.id },
    }),
  );
  ok(
    await careGroupMemberModel.create({
      ...system,
      data: { groupId: group.id, userId: viewer.user.id, role: "viewer" },
    }),
  );
  return { owner, caretaker, viewer, group, recipient };
};

const tagOf = () => `G${randomUUID().slice(0, 8)}`;

describe("admin.groups reads", () => {
  it("finds groups by group or recipient name, with members, owners and created date", async () => {
    const { api } = await staff("support");
    const tag = tagOf();
    const { group, owner } = await tagged(tag);

    for (const q of [`${tag} Fam`, `${tag} Recip`, `nana ${tag.toLowerCase()}`]) {
      const res = await api.admin.groups.search({ q });
      expect(res.count).toBe(1);
      expect(res.groups[0]).toMatchObject({
        id: group.id,
        name: `${tag} Family`,
        recipientName: `${tag} Recipient`,
        memberCount: 3,
        owners: [{ id: owner.user.id, email: owner.user.email }],
      });
      expect(Date.parse(res.groups[0]!.createdAt)).not.toBeNaN();
    }
    // A pattern's wildcards match only themselves.
    expect((await api.admin.groups.search({ q: `${tag}%` })).count).toBe(0);
  });

  it("filters to groups with no owner, such as one whose only owner left", async () => {
    const { api } = await staff("support");
    const tag = tagOf();
    const orphaned = await tagged(`${tag}a`);
    const owned = await tagged(`${tag}b`);
    // The owner's membership goes (as when their account is deleted).
    ok(
      await careGroupMemberModel.remove({
        ...system,
        filter: {
          groupId: { type: "eq", value: orphaned.group.id },
          userId: { type: "eq", value: orphaned.owner.user.id },
        },
      }),
    );

    const all = await api.admin.groups.search({ q: tag });
    expect(all.groups.map((g) => g.id).sort()).toEqual([orphaned.group.id, owned.group.id].sort());
    const ownerless = await api.admin.groups.search({ q: tag, noOwner: true });
    expect(ownerless.groups.map((g) => g.id)).toEqual([orphaned.group.id]);
    expect(ownerless.groups[0]!.owners).toEqual([]);
    expect(ownerless.groups[0]!.memberCount).toBe(2);
  });

  it("gives a group's members, counts and dates, and selects no content columns", async () => {
    const { api, user: supportUser } = await staff("support");
    const tag = tagOf();
    const { group, owner, caretaker } = await tagged(tag);
    const secret = `Secret-${randomUUID()}`;
    ok(
      await timelineEntryService.create(owner.ctx, {
        groupId: group.id,
        kind: "note",
        title: secret,
        occurredAt: "2026-11-10T18:30:00.000Z",
        timeZone: "America/Los_Angeles",
      }),
    );
    ok(
      await timelineEntryService.create(owner.ctx, {
        groupId: group.id,
        kind: "symptom",
        details: { name: secret, severity: 3 },
        occurredAt: "2026-11-10T19:30:00.000Z",
        timeZone: "America/Los_Angeles",
      }),
    );
    ok(
      await providerService.create(owner.ctx, {
        groupId: group.id,
        type: "clinician",
        name: secret,
        address: secret,
      }),
    );
    ok(
      await medicationService.create(owner.ctx, {
        groupId: group.id,
        name: secret,
        directions: secret,
        schedule: { type: "asNeeded" },
      }),
    );

    const res = await api.admin.groups.get({ id: group.id });
    expect(res).toMatchObject({
      id: group.id,
      name: `${tag} Family`,
      recipientName: `${tag} Recipient`,
      recipientPreferredName: `Nana ${tag}`,
      // Two entries, plus the medication's "started" change entry.
      counts: { entries: 3, providers: 1, medications: 1 },
    });
    expect(Date.parse(res.lastActivityAt!)).toBeGreaterThanOrEqual(Date.parse(res.createdAt));
    const caretakerRow = res.members.find((m) => m.userId === caretaker.user.id);
    expect(caretakerRow).toMatchObject({
      role: "caretaker",
      email: caretaker.user.email,
      invitedBy: { id: owner.user.id, email: owner.user.email },
    });
    expect(res.members.map((m) => m.role).sort()).toEqual(["caretaker", "owner", "viewer"]);

    // No care content anywhere in the answer: not the text, and no key that
    // is a care table's content column. `id`, `name`, `email` and the
    // timestamps are the group's, the recipient's names and members' accounts.
    expect(JSON.stringify(res)).not.toContain(secret);
    const allowed = new Set(["id", "groupId", "name", "preferredName", "email", "createdAt", "updatedAt"]);
    const contentColumns = new Set(
      [
        timelineEntrySchema,
        noteDocumentSchema,
        providerSchema,
        medicationSchema,
        carePeriodSchema,
        careRecipientSchema,
        careRecipientDetailsSchema,
      ]
        .flatMap((table) => Object.entries(table))
        .filter(([, column]) => !!column && typeof column === "object" && "columnType" in column)
        .map(([key]) => key)
        .filter((column) => !allowed.has(column)),
    );
    expect(keysOf(res).filter((key) => contentColumns.has(key))).toEqual([]);

    // Opening it records a view (in the background).
    await expect
      .poll(async () => (await auditFor(group.id, "group.view")).map((e) => e.actor?.id))
      .toEqual([supportUser.id]);
  });

  it("answers a 404 for an unknown group", async () => {
    const { api } = await staff("support");
    expect(await codeOf(api.admin.groups.get({ id: randomUUID() }))).toBe("NOT_FOUND:");
  });
});

describe("admin.groups writes", () => {
  it("promotes a member to owner, changes a role and removes a member, one audit entry each", async () => {
    const { api, user: adminUser } = await staff("admin");
    const { group, caretaker, viewer, owner } = await tagged(tagOf());
    const reason = "Owner's family asked by phone; verified";

    expect(
      await api.admin.groups.promoteOwner({ groupId: group.id, userId: caretaker.user.id, reason }),
    ).toEqual({ groupId: group.id, userId: caretaker.user.id, role: "owner" });
    expect(await roleOf(group.id, caretaker.user.id)).toBe("owner");
    const promoted = await auditFor(group.id, "group.promoteOwner");
    expect(promoted).toHaveLength(1);
    expect(promoted[0]).toMatchObject({
      actor: { id: adminUser.id },
      targetUser: { id: caretaker.user.id },
      reason,
      changes: { role: ["caretaker", "owner"] },
    });
    // invited_by stays as it was.
    const after = ok(
      await careGroupMemberModel.get({
        ...system,
        filter: {
          groupId: { type: "eq", value: group.id },
          userId: { type: "eq", value: caretaker.user.id },
        },
      }),
    );
    expect(after?.invitedBy).toBe(owner.user.id);

    await api.admin.groups.changeRole({ groupId: group.id, userId: viewer.user.id, role: "admin", reason });
    expect(await roleOf(group.id, viewer.user.id)).toBe("admin");
    expect(await auditFor(group.id, "group.changeRole")).toMatchObject([
      { changes: { role: ["viewer", "admin"] }, reason },
    ]);

    // With two owners, one may be demoted and one removed.
    await api.admin.groups.changeRole({
      groupId: group.id,
      userId: owner.user.id,
      role: "caretaker",
      reason,
    });
    expect(await roleOf(group.id, owner.user.id)).toBe("caretaker");
    await api.admin.groups.removeMember({ groupId: group.id, userId: viewer.user.id, reason });
    expect(await roleOf(group.id, viewer.user.id)).toBeNull();
    expect(await auditFor(group.id, "group.removeMember")).toMatchObject([
      { targetUser: { id: viewer.user.id }, changes: { role: ["admin", null] }, reason },
    ]);
    expect(await auditFor(group.id, "group.changeRole")).toHaveLength(2);
  });

  it("never leaves a group without an owner, and records nothing when refused", async () => {
    const { api } = await staff("admin");
    const { group, owner, caretaker } = await tagged(tagOf());
    const reason = "Requested";
    expect(
      await codeOf(
        api.admin.groups.changeRole({ groupId: group.id, userId: owner.user.id, role: "admin", reason }),
      ),
    ).toBe("CONFLICT:careGroupMemberService:lastOwner");
    expect(
      await codeOf(api.admin.groups.removeMember({ groupId: group.id, userId: owner.user.id, reason })),
    ).toBe("CONFLICT:careGroupMemberService:lastOwner");
    expect(await roleOf(group.id, owner.user.id)).toBe("owner");
    // Already that role; not a member; no such group.
    expect(
      await codeOf(api.admin.groups.promoteOwner({ groupId: group.id, userId: owner.user.id, reason })),
    ).toBe("CONFLICT:groupAdminService:unchanged");
    const stranger = await createUser("grp-stranger");
    expect(
      await codeOf(api.admin.groups.removeMember({ groupId: group.id, userId: stranger.user.id, reason })),
    ).toBe("NOT_FOUND:groupAdminService:notMember");
    expect(
      await codeOf(
        api.admin.groups.promoteOwner({ groupId: randomUUID(), userId: caretaker.user.id, reason }),
      ),
    ).toBe("NOT_FOUND:groupAdminService:notFound");
    // A reason is required.
    expect(
      await codeOf(
        api.admin.groups.promoteOwner({ groupId: group.id, userId: caretaker.user.id, reason: " " }),
      ),
    ).toBe("BAD_REQUEST:");

    for (const action of ["group.changeRole", "group.removeMember", "group.promoteOwner"])
      expect(await auditFor(group.id, action)).toEqual([]);
  });

  it("sends an owner invite to an address, attested by the admin", async () => {
    const { api, user: adminUser } = await staff("admin");
    const { group } = await tagged(tagOf());
    const email = `new-owner-${randomUUID().slice(0, 8)}@example.com`;
    const sent = await api.admin.groups.inviteOwner({ groupId: group.id, email, reason: "Only owner died" });
    expect(sent.email).toBe(email);

    const queued = await getDb().query.notificationOutboxSchema.findMany({
      where: (t, { and, eq }) => and(eq(t.recipient, email), eq(t.name, "ownerInvite")),
    });
    expect(queued).toHaveLength(1);
    const invite = await getDb().query.careGroupInviteSchema.findFirst({
      where: (t, { eq }) => eq(t.id, sent.inviteId),
    });
    expect(invite).toMatchObject({ role: "owner", status: "pending", consentAttestedBy: adminUser.id });
    expect(await auditFor(group.id, "group.inviteOwner")).toMatchObject([
      { actor: { id: adminUser.id }, reason: "Only owner died", changes: { email: [null, email] } },
    ]);
    // A second invite to the same address waits on the first.
    expect(await codeOf(api.admin.groups.inviteOwner({ groupId: group.id, email, reason: "Again" }))).toBe(
      "CONFLICT:careGroupInviteService:alreadyInvited",
    );
    expect(await auditFor(group.id, "group.inviteOwner")).toHaveLength(1);
  });

  it("refuses support every write (a 403) and a member everything", async () => {
    const support = await staff("support");
    const member = await createUser("grp-member");
    const memberApi = clientFor(member.ctx.authUser);
    const { group, caretaker } = await tagged(tagOf());
    const input = { groupId: group.id, userId: caretaker.user.id, reason: "Because" };

    for (const api of [support.api, memberApi]) {
      expect(await codeOf(api.admin.groups.promoteOwner(input))).toBe("FORBIDDEN:");
      expect(await codeOf(api.admin.groups.changeRole({ ...input, role: "viewer" }))).toBe("FORBIDDEN:");
      expect(await codeOf(api.admin.groups.removeMember(input))).toBe("FORBIDDEN:");
      expect(
        await codeOf(
          api.admin.groups.inviteOwner({
            groupId: group.id,
            email: "someone@example.com",
            reason: "Because",
          }),
        ),
      ).toBe("FORBIDDEN:");
    }
    expect(await codeOf(memberApi.admin.groups.search({}))).toBe("FORBIDDEN:");
    expect(await codeOf(memberApi.admin.groups.get({ id: group.id }))).toBe("FORBIDDEN:");
    expect(await roleOf(group.id, caretaker.user.id)).toBe("caretaker");
    for (const action of [
      "group.promoteOwner",
      "group.changeRole",
      "group.removeMember",
      "group.inviteOwner",
    ])
      expect(await auditFor(group.id, action)).toEqual([]);
  });
});
