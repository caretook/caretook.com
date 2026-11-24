import type { InviteEmail, InviteMailer } from "./careGroupInviteService";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createUser, createWorld, ok, system } from "../../test/fixtures";
import { getDb } from "../db";
import { appSettingSchema, careGroupInviteSchema, CONSENT_VERSION, userSchema } from "../db/schema";
import { isError, newError } from "../errors";
import { careGroupConsentModel, careGroupInviteModel, careGroupMemberModel } from "../models";
import {
  appSettingService,
  careGroupConsentService,
  careGroupInviteService,
  careGroupMemberService,
  groupAdminService,
  staffGroupService,
  userService,
} from ".";

// Email invites (invites slice 3). Each test builds its own group and users.

const codeOf = (res: unknown) => (isError(res) ? res.code : "ok");

const setup = async () => {
  const { u, groupId } = await createWorld({
    names: { owner: "inv-owner", admin: "inv-admin", caretaker: "inv-caretaker", viewer: "inv-viewer" },
  });
  return { ...u, groupId };
};

/** A mailer that records what it was asked to send. */
const recordingMailer = () => {
  const sent: InviteEmail[] = [];
  const mail: InviteMailer = (email) => {
    sent.push(email);
    return Promise.resolve({ id: randomUUID() });
  };
  return { sent, mail };
};

const newAddress = (label: string) => `${label}-${randomUUID().slice(0, 8)}@example.com`;

const invite = async (
  actor: { ctx: Parameters<typeof careGroupInviteService.createEmail>[0] },
  groupId: string,
  email: string,
  role: "owner" | "admin" | "caretaker" | "viewer" = "caretaker",
) => ok(await careGroupInviteService.createEmail(actor.ctx, { groupId, email, role, attested: true }));

/** A user with this exact email (the invite's address). */
const userWith = async (email: string) => {
  const user = ok(await userService.create(system, { email, name: "Invitee" }));
  if (!user) throw new Error("user not readable");
  return { user, ctx: { authUser: { id: user.id, roleNames: user.roleNames } } };
};

const roleOf = (groupId: string, userId: string) => careGroupMemberModel.getRole(groupId, userId);

describe("creating an email invite", () => {
  it("records the attestation, sends the email in the transaction, and never returns the hash", async () => {
    const s = await setup();
    const { sent, mail } = recordingMailer();
    const email = newAddress("sib");
    const res = ok(
      await careGroupInviteService.createEmail(
        s.admin.ctx,
        { groupId: s.groupId, email: email.toUpperCase(), role: "viewer", attested: true },
        { mail },
      ),
    );
    expect(res.invite).toMatchObject({
      kind: "email",
      email,
      role: "viewer",
      consentAttestedBy: s.admin.user.id,
      consentVersion: CONSENT_VERSION,
    });
    expect(res.invite.consentAttestedAt).toBeTruthy();
    expect(res.invite).not.toHaveProperty("tokenHash");
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ token: res.token, groupName: "Pat Example", inviterName: "inv-admin" });
  });

  it("refuses without the attestation", async () => {
    const s = await setup();
    expect(
      codeOf(
        await careGroupInviteService.createEmail(s.owner.ctx, {
          groupId: s.groupId,
          email: newAddress("x"),
          role: "viewer",
          attested: false,
        }),
      ),
    ).toBe("careGroupInviteService:notAttested");
  });

  it("rolls the invite back when its email can't be queued", async () => {
    const s = await setup();
    const email = newAddress("rollback");
    const res = await careGroupInviteService.createEmail(
      s.owner.ctx,
      { groupId: s.groupId, email, role: "viewer", attested: true },
      { mail: () => Promise.resolve(newError({ code: "notify:enqueue" })) },
    );
    expect(codeOf(res)).toBe("notify:enqueue");
    const rows = await getDb()
      .select()
      .from(careGroupInviteSchema)
      .where(eq(careGroupInviteSchema.email, email));
    expect(rows).toHaveLength(0);
  });

  it("lets only owners invite owners, and refuses caretakers and viewers", async () => {
    const s = await setup();
    const attempt = (who: typeof s.owner, role: "owner" | "viewer") =>
      careGroupInviteService.createEmail(who.ctx, {
        groupId: s.groupId,
        email: newAddress("o"),
        role,
        attested: true,
      });
    expect(codeOf(await attempt(s.admin, "owner"))).toBe("careGroupInviteService:ownerOnly");
    expect(codeOf(await attempt(s.owner, "owner"))).toBe("ok");
    expect(codeOf(await attempt(s.caretaker, "viewer"))).toBe("permissions:unauthorized");
    expect(codeOf(await attempt(s.viewer, "viewer"))).toBe("permissions:unauthorized");
  });

  it("refuses a current member and a second waiting invite", async () => {
    const s = await setup();
    expect(
      codeOf(
        await careGroupInviteService.createEmail(s.owner.ctx, {
          groupId: s.groupId,
          email: s.viewer.user.email,
          role: "caretaker",
          attested: true,
        }),
      ),
    ).toBe("careGroupInviteService:alreadyMember");
    const email = newAddress("twice");
    await invite(s.owner, s.groupId, email);
    expect(
      codeOf(
        await careGroupInviteService.createEmail(s.owner.ctx, {
          groupId: s.groupId,
          email,
          role: "viewer",
          attested: true,
        }),
      ),
    ).toBe("careGroupInviteService:alreadyInvited");
  });
});

describe("accepting", () => {
  it("joins with the role, records consent, verifies the email and marks the invite accepted", async () => {
    const s = await setup();
    const email = newAddress("joiner");
    const { token, invite: sent } = await invite(s.owner, s.groupId, email, "caretaker");
    const joiner = await userWith(email);

    expect(
      ok(await careGroupInviteService.accept(joiner.ctx, { token, consent: true, legal: true })),
    ).toMatchObject({
      groupId: s.groupId,
      role: "caretaker",
    });
    expect(await roleOf(s.groupId, joiner.user.id)).toBe("caretaker");

    const membership = ok(
      await careGroupMemberService.get(system, {
        filter: { groupId: { type: "eq", value: s.groupId }, userId: { type: "eq", value: joiner.user.id } },
      }),
    );
    expect(membership?.invitedBy).toBe(s.owner.user.id);

    const consents = ok(
      await careGroupConsentModel.list({
        ...system,
        filter: { userId: { type: "eq", value: joiner.user.id } },
      }),
    ).data;
    expect(consents).toHaveLength(1);
    expect(consents[0]).toMatchObject({
      groupId: s.groupId,
      kind: "joiner",
      consentVersion: CONSENT_VERSION,
      inviteId: sent.id,
    });

    const [user] = await getDb().select().from(userSchema).where(eq(userSchema.id, joiner.user.id));
    expect(user?.emailVerified).toBe(true);
    expect(ok(await careGroupInviteModel.getById(sent.id, system))).toMatchObject({
      status: "accepted",
      acceptedBy: joiner.user.id,
    });

    // Consent rows: the member and the group's managers read them; others don't.
    expect(ok(await careGroupConsentService.list(joiner.ctx)).count).toBe(1);
    expect(
      ok(
        await careGroupConsentService.list(s.admin.ctx, {
          filter: { groupId: { type: "eq", value: s.groupId } },
        }),
      ).count,
    ).toBe(1);
    expect(
      ok(
        await careGroupConsentService.list(s.caretaker.ctx, {
          filter: { groupId: { type: "eq", value: s.groupId } },
        }),
      ).count,
    ).toBe(0);
  });

  it("is idempotent", async () => {
    const s = await setup();
    const email = newAddress("again");
    const { token } = await invite(s.owner, s.groupId, email, "viewer");
    const joiner = await userWith(email);
    ok(await careGroupInviteService.accept(joiner.ctx, { token, consent: true, legal: true }));
    expect(
      ok(await careGroupInviteService.accept(joiner.ctx, { token, consent: true, legal: true })),
    ).toMatchObject({
      groupId: s.groupId,
      role: "viewer",
    });
    const consents = ok(
      await careGroupConsentModel.list({
        ...system,
        filter: { userId: { type: "eq", value: joiner.user.id } },
      }),
    );
    expect(consents.count).toBe(1);
  });

  it("refuses another address, a missing consent, and someone else after it's accepted", async () => {
    const s = await setup();
    const email = newAddress("right");
    const { token } = await invite(s.owner, s.groupId, email);
    const stranger = await userWith(newAddress("wrong"));
    expect(
      codeOf(await careGroupInviteService.accept(stranger.ctx, { token, consent: true, legal: true })),
    ).toBe("careGroupInviteService:wrongEmail");
    expect(await roleOf(s.groupId, stranger.user.id)).toBeNull();

    const joiner = await userWith(email);
    expect(codeOf(await careGroupInviteService.accept(joiner.ctx, { token, consent: false }))).toBe(
      "careGroupInviteService:noConsent",
    );
    expect(
      codeOf(await careGroupInviteService.accept(s.viewer.ctx, { token, consent: true, legal: true })),
    ).toBe("careGroupInviteService:wrongEmail");
    expect(
      codeOf(await careGroupInviteService.accept({ authUser: null }, { token, consent: true, legal: true })),
    ).toBe("permissions:unauthenticated");
  });

  it("accepts the address whatever its case or spaces", async () => {
    const s = await setup();
    const email = newAddress("case");
    const { token } = await invite(s.owner, s.groupId, `  ${email.toUpperCase()} `);
    const joiner = await userWith(email);
    expect(
      codeOf(await careGroupInviteService.accept(joiner.ctx, { token, consent: true, legal: true })),
    ).toBe("ok");
  });

  it("refuses expired, revoked and declined invites", async () => {
    const s = await setup();
    const expired = await invite(s.owner, s.groupId, newAddress("exp"));
    await getDb()
      .update(careGroupInviteSchema)
      .set({ expiresAt: new Date(Date.now() - 1000).toISOString() })
      .where(eq(careGroupInviteSchema.id, expired.invite.id));
    const expiredUser = await userWith(expired.invite.email!);
    expect(
      codeOf(
        await careGroupInviteService.accept(expiredUser.ctx, {
          token: expired.token,
          consent: true,
          legal: true,
        }),
      ),
    ).toBe("careGroupInviteService:unusable");

    const revoked = await invite(s.owner, s.groupId, newAddress("rev"));
    ok(await careGroupInviteService.revoke(s.admin.ctx, revoked.invite.id));
    const revokedUser = await userWith(revoked.invite.email!);
    expect(
      codeOf(
        await careGroupInviteService.accept(revokedUser.ctx, {
          token: revoked.token,
          consent: true,
          legal: true,
        }),
      ),
    ).toBe("careGroupInviteService:unusable");

    const declined = await invite(s.owner, s.groupId, newAddress("dec"));
    ok(await careGroupInviteService.decline(declined.token));
    const declinedUser = await userWith(declined.invite.email!);
    expect(
      codeOf(
        await careGroupInviteService.accept(declinedUser.ctx, {
          token: declined.token,
          consent: true,
          legal: true,
        }),
      ),
    ).toBe("careGroupInviteService:unusable");
    expect(await roleOf(s.groupId, declinedUser.user.id)).toBeNull();
  });

  it("lets an owner invite make an owner", async () => {
    const s = await setup();
    const email = newAddress("newowner");
    const { token } = await invite(s.owner, s.groupId, email, "owner");
    const joiner = await userWith(email);
    ok(await careGroupInviteService.accept(joiner.ctx, { token, consent: true, legal: true }));
    expect(await roleOf(s.groupId, joiner.user.id)).toBe("owner");
  });
});

describe("declining, resending, revoking and previewing", () => {
  it("declines once, by the link's holder", async () => {
    const s = await setup();
    const { token, invite: sent } = await invite(s.owner, s.groupId, newAddress("no"));
    expect(ok(await careGroupInviteService.decline(token))).toEqual({ groupId: s.groupId });
    expect(ok(await careGroupInviteModel.getById(sent.id, system))?.status).toBe("declined");
    expect(codeOf(await careGroupInviteService.decline("not-a-real-token-at-all"))).toBe(
      "careGroupInviteService:notFound",
    );
  });

  it("resend rotates the token: the old link stops working and the new one works", async () => {
    const s = await setup();
    const email = newAddress("resend");
    const first = await invite(s.owner, s.groupId, email);
    const { sent, mail } = recordingMailer();
    const again = ok(await careGroupInviteService.resend(s.admin.ctx, first.invite.id, { mail }));
    expect(again.token).not.toBe(first.token);
    expect(sent.map((m) => m.token)).toEqual([again.token]);
    expect(await careGroupInviteService.preview(first.token)).toBeNull();

    const joiner = await userWith(email);
    expect(
      codeOf(
        await careGroupInviteService.accept(joiner.ctx, { token: first.token, consent: true, legal: true }),
      ),
    ).toBe("careGroupInviteService:notFound");
    expect(
      codeOf(
        await careGroupInviteService.accept(joiner.ctx, { token: again.token, consent: true, legal: true }),
      ),
    ).toBe("ok");
  });

  it("resend is for managers, and owner invites for owners", async () => {
    const s = await setup();
    const owners = await invite(s.owner, s.groupId, newAddress("o"), "owner");
    expect(codeOf(await careGroupInviteService.resend(s.admin.ctx, owners.invite.id))).toBe(
      "careGroupInviteService:ownerOnly",
    );
    const plain = await invite(s.owner, s.groupId, newAddress("p"));
    expect(codeOf(await careGroupInviteService.resend(s.caretaker.ctx, plain.invite.id))).toBe(
      "careGroupInviteService:notFound",
    );
  });

  it("revoke stops the link at once", async () => {
    const s = await setup();
    const { token, invite: sent } = await invite(s.owner, s.groupId, newAddress("stop"));
    ok(await careGroupInviteService.revoke(s.owner.ctx, sent.id));
    expect(ok(await careGroupInviteService.preview(token))).toMatchObject({
      state: "revoked",
      groupName: null,
      invite: null,
    });
  });

  it("previews a usable invite with names, and an unusable one with its state only", async () => {
    const s = await setup();
    const { token } = await invite(s.owner, s.groupId, newAddress("peek"), "viewer");
    expect(ok(await careGroupInviteService.preview(token))).toMatchObject({
      state: "usable",
      groupName: "Pat Example",
      inviterName: "inv-owner",
      invite: { role: "viewer" },
    });
    ok(await careGroupInviteService.decline(token));
    expect(ok(await careGroupInviteService.preview(token))).toMatchObject({
      state: "declined",
      groupName: null,
    });
  });

  it("a ticket is only a usable email invite", async () => {
    const s = await setup();
    const { token, invite: sent } = await invite(s.owner, s.groupId, newAddress("ticket"));
    expect(ok(await careGroupInviteService.ticketFor(token))).toMatchObject({ id: sent.id });
    ok(await careGroupInviteService.revoke(s.owner.ctx, sent.id));
    expect(codeOf(await careGroupInviteService.ticketFor(token))).toBe("ticket:invalid");
    expect(codeOf(await careGroupInviteService.ticketFor("made-up-token-made-up"))).toBe("ticket:invalid");
  });
});

describe("while signup.emailInvites is off (B-106)", () => {
  /** Run `body` with email invites switched off, then put the settings back. */
  const withEmailInvitesOff = async (
    body: (staff: Awaited<ReturnType<typeof createUser>>) => Promise<void>,
  ) => {
    const staff = await createUser("inv-staff", "admin");
    ok(
      await appSettingService.setSetting(staff.ctx, {
        key: "signup.emailInvites",
        value: false,
        reason: "Abuse",
      }),
    );
    try {
      await body(staff);
    } finally {
      await getDb().delete(appSettingSchema);
      appSettingService.clearSettingsCache();
    }
  };

  /** Previewing, the sign-up ticket and accepting, as the invited address. */
  const useInvite = async (token: string, email: string) => {
    const preview = await careGroupInviteService.preview(token);
    const ticket = codeOf(await careGroupInviteService.ticketFor(token));
    const invitee = await userWith(email);
    const accepted = await careGroupInviteService.accept(invitee.ctx, { token, consent: true, legal: true });
    return { preview, ticket, accepted, invitee };
  };

  it("lets a staff owner invite to a group be previewed and accepted", async () => {
    const s = await setup();
    await withEmailInvitesOff(async (staff) => {
      const { sent, mail } = recordingMailer();
      const email = newAddress("staff-owner");
      ok(
        await groupAdminService.inviteOwner(
          staff.ctx,
          { groupId: s.groupId, email, reason: "Owner left" },
          { mail },
        ),
      );
      const token = sent[0]?.token ?? "";

      const used = await useInvite(token, email);
      expect(used.preview).toMatchObject({ state: "usable", invite: { role: "owner" } });
      expect(used.ticket).toBe("ok");
      expect(used.accepted).toMatchObject({ status: "joined", groupId: s.groupId, role: "owner" });
      expect(await roleOf(s.groupId, used.invitee.user.id)).toBe("owner");
    });
  });

  it("lets the owner invite of a staff-made group be previewed and accepted", async () => {
    await withEmailInvitesOff(async (staff) => {
      const { sent, mail } = recordingMailer();
      const email = newAddress("staff-new");
      const made = ok(
        await staffGroupService.createWithOwnerInvite(
          staff.ctx,
          { groupName: "Switch-off group", recipientName: "Lou Example", ownerEmail: email, attested: true },
          { mail },
        ),
      );
      const token = sent[0]?.token ?? "";

      const used = await useInvite(token, email);
      expect(used.preview).toMatchObject({ state: "usable" });
      expect(used.ticket).toBe("ok");
      expect(used.accepted).toMatchObject({ status: "joined", groupId: made.groupId, role: "owner" });
    });
  });

  it("still refuses a member's email invite, an owner's owner invite included, at preview and accept", async () => {
    const s = await setup();
    const viewerEmail = newAddress("member-viewer");
    const ownerEmail = newAddress("member-owner");
    const viewerInvite = await invite(s.owner, s.groupId, viewerEmail, "viewer");
    const ownerInvite = await invite(s.owner, s.groupId, ownerEmail, "owner");
    await withEmailInvitesOff(async () => {
      for (const [made, email] of [
        [viewerInvite, viewerEmail],
        [ownerInvite, ownerEmail],
      ] as const) {
        const used = await useInvite(made.token, email);
        expect(used.preview).toMatchObject({ state: "unavailable", invite: null });
        expect(used.ticket).toBe("settings:signupClosed");
        expect(codeOf(used.accepted)).toBe("settings:signupClosed");
        expect(await roleOf(s.groupId, used.invitee.user.id)).toBeNull();
      }
    });
  });
});
