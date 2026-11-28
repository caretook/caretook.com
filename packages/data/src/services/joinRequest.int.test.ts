import type { JoinMailer, JoinNotice } from "./joinRequestService";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createUser, createWorld, ok, system } from "../../test/fixtures";
import { getDb } from "../db";
import { careGroupInviteSchema, careGroupJoinRequestSchema, CONSENT_VERSION } from "../db/schema";
import { isError } from "../errors";
import { careGroupConsentModel, careGroupMemberModel } from "../models";
import { careGroupInviteService, joinRequestService, timelineEntryService } from ".";
import { REASK_COOLDOWN_DAYS } from "./joinRequestService";

// Invite links and join requests (invites slice 4). Each test builds its own group and users.

const codeOf = (res: unknown) => (isError(res) ? res.code : "ok");

const setup = async () => {
  const { u, groupId } = await createWorld({
    members: ["admin", "caretaker"],
    extras: ["outsider"],
    names: {
      owner: "link-owner",
      admin: "link-admin",
      caretaker: "link-caretaker",
      outsider: "link-outsider",
    },
  });
  return { ...u, groupId };
};

const recordingMailer = () => {
  const sent: JoinNotice[] = [];
  const mail: JoinMailer = (notice) => {
    sent.push(notice);
    return Promise.resolve(notice.to.map(() => randomUUID()));
  };
  return { sent, mail };
};

type Actor = { ctx: Parameters<typeof careGroupInviteService.createLink>[0] };

const link = async (actor: Actor, groupId: string, opts: { maxUses?: number; expiresInDays?: number } = {}) =>
  ok(
    await careGroupInviteService.createLink(actor.ctx, {
      groupId,
      role: "viewer",
      expiresInDays: opts.expiresInDays ?? 7,
      maxUses: opts.maxUses ?? null,
    }),
  );

const ask = (actor: Actor, token: string, mail?: JoinMailer) =>
  careGroupInviteService.accept(
    actor.ctx,
    { token, consent: true, legal: true },
    mail ? { joinMail: mail } : {},
  );

const roleOf = (groupId: string, userId: string) => careGroupMemberModel.getRole(groupId, userId);

describe("creating a link", () => {
  it("lets owners and admins make caretaker and viewer links only", async () => {
    const s = await setup();
    const made = await link(s.admin, s.groupId, { maxUses: 3 });
    expect(made.invite).toMatchObject({ kind: "link", email: null, role: "viewer", maxUses: 3, useCount: 0 });
    expect(made.invite).not.toHaveProperty("tokenCiphertext");
    expect(made.token.length).toBeGreaterThan(20);

    for (const role of ["owner", "admin"] as const) {
      const res = await careGroupInviteService.createLink(s.owner.ctx, {
        groupId: s.groupId,
        role: role as never,
        expiresInDays: 7,
      });
      expect(codeOf(res)).toBe("careGroupInviteService:linkRole");
    }
    const byCaretaker = await careGroupInviteService.createLink(s.caretaker.ctx, {
      groupId: s.groupId,
      role: "viewer",
      expiresInDays: 7,
    });
    expect(codeOf(byCaretaker)).toBe("careGroupInviteService:notAllowed");
    const byOutsider = await careGroupInviteService.createLink(s.outsider.ctx, {
      groupId: s.groupId,
      role: "viewer",
      expiresInDays: 7,
    });
    expect(codeOf(byOutsider)).toBe("careGroupInviteService:notAllowed");
  });

  it("can't be stored with an owner or admin role, even by the system", async () => {
    const s = await setup();
    const made = await link(s.owner, s.groupId);
    await expect(
      getDb()
        .update(careGroupInviteSchema)
        .set({ role: "admin" })
        .where(eq(careGroupInviteSchema.id, made.invite.id)),
    ).rejects.toThrow();
  });

  it("keeps the token sealed, and copyLink gives it back to managers while it's active", async () => {
    const s = await setup();
    const made = await link(s.owner, s.groupId);
    const [row] = await getDb()
      .select()
      .from(careGroupInviteSchema)
      .where(eq(careGroupInviteSchema.id, made.invite.id));
    expect(row?.tokenCiphertext).toBeTruthy();
    expect(row?.tokenCiphertext).not.toContain(made.token);

    expect(ok(await careGroupInviteService.copyLink(s.admin.ctx, made.invite.id)).token).toBe(made.token);
    expect(codeOf(await careGroupInviteService.copyLink(s.caretaker.ctx, made.invite.id))).toBe(
      "careGroupInviteService:notFound",
    );
    ok(await careGroupInviteService.revoke(s.owner.ctx, made.invite.id));
    expect(codeOf(await careGroupInviteService.copyLink(s.owner.ctx, made.invite.id))).toBe(
      "careGroupInviteService:linkInactive",
    );
  });

  it("never gives back an email invite's token", async () => {
    const s = await setup();
    const email = ok(
      await careGroupInviteService.createEmail(s.owner.ctx, {
        groupId: s.groupId,
        email: `x-${randomUUID().slice(0, 8)}@example.com`,
        role: "viewer",
        attested: true,
      }),
    );
    expect(codeOf(await careGroupInviteService.copyLink(s.owner.ctx, email.invite.id))).toBe(
      "careGroupInviteService:notLink",
    );
    const [row] = await getDb()
      .select()
      .from(careGroupInviteSchema)
      .where(eq(careGroupInviteSchema.id, email.invite.id));
    expect(row?.tokenCiphertext).toBeNull();
  });
});

describe("asking to join with a link", () => {
  it("makes one pending request, records consent, counts a use and emails owners and admins", async () => {
    const s = await setup();
    const made = await link(s.owner, s.groupId);
    const joiner = await createUser("link-joiner");
    const { sent, mail } = recordingMailer();

    const first = ok(await ask(joiner, made.token, mail));
    expect(first).toMatchObject({ status: "requested", groupId: s.groupId, role: "viewer" });
    expect(await roleOf(s.groupId, joiner.user.id)).toBeNull();

    // A requester sees nothing of the group.
    const seen = await timelineEntryService.list(joiner.ctx, { groupId: s.groupId });
    expect(isError(seen) || seen.data.length === 0).toBe(true);

    expect(sent).toHaveLength(1);
    expect(sent[0]?.kind).toBe("joinRequested");
    expect(sent[0]?.to.map((t) => t.userId).sort()).toEqual([s.owner.user.id, s.admin.user.id].sort());
    // Managers' addresses, read as the system (co-members can't read them).
    expect(sent[0]?.to.map((t) => t.email).sort()).toEqual([s.owner.user.email, s.admin.user.email].sort());
    expect(sent[0]).toMatchObject({
      groupName: "Pat Example",
      requester: { name: "link-joiner", email: joiner.user.email },
    });

    // Asking again returns the same request: no second use, consent or email.
    const again = ok(await ask(joiner, made.token, mail));
    expect(again.status === "requested" && first.status === "requested" && again.requestId).toBe(
      first.status === "requested" && first.requestId,
    );
    expect(sent).toHaveLength(1);
    const listed = ok(await careGroupInviteService.getById(s.owner.ctx, made.invite.id));
    expect(listed?.useCount).toBe(1);
    const consents = ok(
      await careGroupConsentModel.list({
        ...system,
        filter: { userId: { type: "eq", value: joiner.user.id } },
      }),
    ).data;
    expect(consents).toHaveLength(1);
    expect(consents[0]).toMatchObject({
      groupId: s.groupId,
      consentVersion: CONSENT_VERSION,
      inviteId: made.invite.id,
    });

    const mine = ok(
      await joinRequestService.list(joiner.ctx, {
        filter: { userId: { type: "eq", value: joiner.user.id } },
      }),
    ).data;
    expect(mine).toHaveLength(1);
  });

  it("enforces maximum uses and expiry, and stops at once when revoked", async () => {
    const s = await setup();
    const once = await link(s.owner, s.groupId, { maxUses: 1 });
    const a = await createUser("link-a");
    const b = await createUser("link-b");
    ok(await ask(a, once.token));
    expect(codeOf(await ask(b, once.token))).toBe("careGroupInviteService:unusable");
    // The one who asked still has their request.
    expect(ok(await ask(a, once.token)).status).toBe("requested");

    const old = await link(s.owner, s.groupId);
    await getDb()
      .update(careGroupInviteSchema)
      .set({ expiresAt: new Date(Date.now() - 1000).toISOString() })
      .where(eq(careGroupInviteSchema.id, old.invite.id));
    expect(codeOf(await ask(b, old.token))).toBe("careGroupInviteService:unusable");

    const revoked = await link(s.owner, s.groupId);
    ok(await careGroupInviteService.revoke(s.admin.ctx, revoked.invite.id));
    expect(codeOf(await ask(b, revoked.token))).toBe("careGroupInviteService:unusable");
  });

  it("lets a member through as they are, with no request", async () => {
    const s = await setup();
    const made = await link(s.owner, s.groupId);
    expect(ok(await ask(s.caretaker, made.token))).toMatchObject({ status: "joined", role: "caretaker" });
  });

  it("refuses without consent", async () => {
    const s = await setup();
    const made = await link(s.owner, s.groupId);
    const joiner = await createUser("link-nc");
    const res = await careGroupInviteService.accept(joiner.ctx, { token: made.token, consent: false });
    expect(codeOf(res)).toBe("careGroupInviteService:noConsent");
  });
});

describe("answering a request", () => {
  const requested = async () => {
    const s = await setup();
    const made = await link(s.owner, s.groupId);
    const joiner = await createUser("link-req");
    const asked = ok(await ask(joiner, made.token));
    if (asked.status !== "requested") throw new Error("expected a request");
    return { ...s, joiner, requestId: asked.requestId, link: made };
  };

  it("approve makes the requester a member with the link's role and emails them", async () => {
    const s = await requested();
    const { sent, mail } = recordingMailer();
    const res = ok(await joinRequestService.approve(s.admin.ctx, s.requestId, { mail }));
    expect(res.request).toMatchObject({ status: "approved", decidedBy: s.admin.user.id });
    expect(await roleOf(s.groupId, s.joiner.user.id)).toBe("viewer");
    const member = ok(
      await careGroupMemberModel.get({
        ...system,
        filter: {
          groupId: { type: "eq", value: s.groupId },
          userId: { type: "eq", value: s.joiner.user.id },
        },
      }),
    );
    // The link's maker is who invited them.
    expect(member?.invitedBy).toBe(s.owner.user.id);
    expect(sent.map((n) => [n.kind, n.to.map((t) => [t.userId, t.email])])).toEqual([
      ["joinApproved", [[s.joiner.user.id, s.joiner.user.email]]],
    ]);

    // Answered once only.
    expect(codeOf(await joinRequestService.approve(s.owner.ctx, s.requestId))).toBe(
      "joinRequestService:notFound",
    );
    expect(codeOf(await joinRequestService.decline(s.owner.ctx, s.requestId))).toBe(
      "joinRequestService:notFound",
    );
  });

  it("decline leaves them out and emails them", async () => {
    const s = await requested();
    const { sent, mail } = recordingMailer();
    ok(await joinRequestService.decline(s.owner.ctx, s.requestId, { mail }));
    expect(await roleOf(s.groupId, s.joiner.user.id)).toBeNull();
    expect(sent.map((n) => n.kind)).toEqual(["joinDeclined"]);
  });

  it("only the group's owners and admins answer; others learn nothing", async () => {
    const s = await requested();
    expect(codeOf(await joinRequestService.approve(s.caretaker.ctx, s.requestId))).toBe(
      "joinRequestService:notAllowed",
    );
    expect(codeOf(await joinRequestService.approve(s.outsider.ctx, s.requestId))).toBe(
      "joinRequestService:notFound",
    );
    // The requester can't approve themselves.
    expect(codeOf(await joinRequestService.approve(s.joiner.ctx, s.requestId))).toBe(
      "joinRequestService:notFound",
    );
    // Managers list the group's requests; caretakers and outsiders don't see them.
    const filter = { groupId: { type: "eq" as const, value: s.groupId } };
    expect(ok(await joinRequestService.list(s.admin.ctx, { filter })).data).toHaveLength(1);
    expect(ok(await joinRequestService.list(s.caretaker.ctx, { filter })).data).toHaveLength(0);
    expect(ok(await joinRequestService.list(s.outsider.ctx, { filter })).data).toHaveLength(0);
  });

  it("the requester withdraws their own, and a new ask after the cooldown makes a new request", async () => {
    const s = await requested();
    expect(codeOf(await joinRequestService.withdraw(s.outsider.ctx, s.requestId))).toBe(
      "joinRequestService:notFound",
    );
    expect(ok(await joinRequestService.withdraw(s.joiner.ctx, s.requestId)).status).toBe("withdrawn");
    await decidedDaysAgo(s.requestId, REASK_COOLDOWN_DAYS + 1);
    const again = ok(await ask(s.joiner, s.link.token));
    expect(again.status === "requested" && again.requestId).not.toBe(s.requestId);
  });
});

/** Move a request's decision `days` into the past. */
const decidedDaysAgo = (requestId: string, days: number) =>
  getDb()
    .update(careGroupJoinRequestSchema)
    .set({ decidedAt: new Date(Date.now() - days * 24 * 60 * 60_000).toISOString() })
    .where(eq(careGroupJoinRequestSchema.id, requestId));

const requestsOf = async (groupId: string, userId: string) =>
  getDb()
    .select({ id: careGroupJoinRequestSchema.id, status: careGroupJoinRequestSchema.status })
    .from(careGroupJoinRequestSchema)
    .where(
      and(eq(careGroupJoinRequestSchema.groupId, groupId), eq(careGroupJoinRequestSchema.userId, userId)),
    );

describe("asking again after a decline or withdrawal (B-334)", () => {
  for (const answer of ["declined", "withdrawn"] as const) {
    it(`a ${answer} requester asking within ${REASK_COOLDOWN_DAYS} days hears "requested", with no new row, use or email`, async () => {
      const s = await setup();
      const made = await link(s.owner, s.groupId);
      const joiner = await createUser(`reask-${answer}`);
      const first = ok(await ask(joiner, made.token));
      if (first.status !== "requested") throw new Error("expected a request");
      if (answer === "declined") ok(await joinRequestService.decline(s.owner.ctx, first.requestId));
      else ok(await joinRequestService.withdraw(joiner.ctx, first.requestId));

      // Just inside the cooldown.
      await decidedDaysAgo(first.requestId, REASK_COOLDOWN_DAYS - 0.01);
      const { sent, mail } = recordingMailer();
      const again = ok(await ask(joiner, made.token, mail));
      expect(again).toMatchObject({ status: "requested", groupId: s.groupId, role: "viewer" });
      expect(sent).toHaveLength(0);
      expect(await requestsOf(s.groupId, joiner.user.id)).toEqual([{ id: first.requestId, status: answer }]);
      expect(ok(await careGroupInviteService.getById(s.owner.ctx, made.invite.id))?.useCount).toBe(1);
      expect(await roleOf(s.groupId, joiner.user.id)).toBeNull();

      // Past it, asking works again: a new pending request, emailed to managers.
      await decidedDaysAgo(first.requestId, REASK_COOLDOWN_DAYS + 0.01);
      const later = ok(await ask(joiner, made.token, mail));
      expect(later.status === "requested" && later.requestId).not.toBe(first.requestId);
      expect(sent.map((n) => n.kind)).toEqual(["joinRequested"]);
      expect((await requestsOf(s.groupId, joiner.user.id)).map((r) => r.status).sort()).toEqual(
        [answer, "pending"].sort(),
      );
    });
  }

  it("another group's decline doesn't hold back a request here", async () => {
    const s = await setup();
    const other = await setup();
    const joiner = await createUser("reask-elsewhere");
    const there = ok(await ask(joiner, (await link(other.owner, other.groupId)).token));
    if (there.status !== "requested") throw new Error("expected a request");
    ok(await joinRequestService.decline(other.owner.ctx, there.requestId));
    const { sent, mail } = recordingMailer();
    ok(await ask(joiner, (await link(s.owner, s.groupId)).token, mail));
    expect(sent.map((n) => n.kind)).toEqual(["joinRequested"]);
  });
});

describe("signing up with a link", () => {
  it("is a ticket for any address", async () => {
    const s = await setup();
    const made = await link(s.owner, s.groupId);
    const invite = ok(await careGroupInviteService.ticketFor(made.token));
    expect(invite.kind).toBe("link");
    ok(await careGroupInviteService.revoke(s.owner.ctx, made.invite.id));
    expect(codeOf(await careGroupInviteService.ticketFor(made.token))).toBe("ticket:invalid");
  });
});
