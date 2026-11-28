import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createUser, createWorld, ok, system } from "../../test/fixtures";
import { getDb } from "../db";
import {
  adminAuditLogSchema,
  careGroupConsentSchema,
  careGroupInviteSchema,
  CONSENT_VERSION,
  connectorGrantSchema,
  legalAcceptanceSchema,
  oauthClientSchema,
} from "../db/schema";
import { careGroupConsentModel, legalAcceptanceModel } from "../models";
import {
  adminAuditService,
  careGroupConsentService,
  careGroupInviteService,
  careGroupService,
  connectorGrantService,
  joinRequestService,
  userService,
} from ".";

// Evidence survives deletion (data-rights PRD, slice 5): a consent row
// carries the inviter's attestation, and consent, legal acceptance and the
// audit log keep bare ids when the account or group they name is deleted.

const setup = async () => {
  const { u, groupId } = await createWorld({
    members: ["admin", "caretaker"],
    extras: ["staff"],
    names: { owner: "ev-owner", admin: "ev-admin", caretaker: "ev-caretaker", staff: "ev-staff" },
  });
  return { ...u, groupId };
};

const newAddress = (label: string) => `${label}-${randomUUID().slice(0, 8)}@example.com`;

/** An account at `email` that accepted an email invite to the group from `inviter`. */
const joinByEmail = async (
  inviter: { ctx: Parameters<typeof careGroupInviteService.createEmail>[0] },
  groupId: string,
) => {
  const email = newAddress("ev-joiner");
  const { token, invite } = ok(
    await careGroupInviteService.createEmail(inviter.ctx, { groupId, email, role: "caretaker", attested: true }),
  );
  const user = ok(await userService.create(system, { email, name: "Invitee" }));
  if (!user) throw new Error("user not readable");
  const joiner = { user, ctx: { authUser: { id: user.id, roleNames: user.roleNames } } };
  ok(await careGroupInviteService.accept(joiner.ctx, { token, consent: true, legal: true }));
  return { joiner, invite };
};

/** A link to the group, used by a new account; its request approved by `approver`. */
const joinByLink = async (
  maker: { ctx: Parameters<typeof careGroupInviteService.createLink>[0] },
  approver: { ctx: Parameters<typeof joinRequestService.approve>[0] },
  groupId: string,
  attest?: { by: string; at: string },
) => {
  const made = ok(
    await careGroupInviteService.createLink(maker.ctx, { groupId, role: "viewer", expiresInDays: 7 }),
  );
  if (attest) {
    await getDb()
      .update(careGroupInviteSchema)
      .set({ consentAttestedBy: attest.by, consentAttestedAt: attest.at, consentVersion: "attested-v0" })
      .where(eq(careGroupInviteSchema.id, made.invite.id));
  }
  const joiner = await createUser("ev-link");
  const asked = ok(
    await careGroupInviteService.accept(joiner.ctx, { token: made.token, consent: true, legal: true }),
  );
  if (asked.status !== "requested") throw new Error("expected a request");
  ok(await joinRequestService.approve(approver.ctx, asked.requestId));
  return { joiner, invite: made.invite };
};

const consentsOf = (userId: string) =>
  getDb().select().from(careGroupConsentSchema).where(eq(careGroupConsentSchema.userId, userId));

describe("the attestation on the consent row", () => {
  it("an email join copies the invite's attestation", async () => {
    const s = await setup();
    const { joiner, invite } = await joinByEmail(s.admin, s.groupId);
    const [consent, ...more] = await consentsOf(joiner.user.id);
    expect(more).toHaveLength(0);
    expect(consent).toMatchObject({
      groupId: s.groupId,
      consentVersion: CONSENT_VERSION,
      inviteId: invite.id,
      consentAttestedBy: s.admin.user.id,
      consentAttestedAt: invite.consentAttestedAt,
      consentAttestedVersion: CONSENT_VERSION,
    });
    expect(consent?.consentAttestedAt).toBeTruthy();
  });

  it("a link approval copies whatever the link carries: nothing, or its attestation", async () => {
    const s = await setup();
    const plain = await joinByLink(s.owner, s.admin, s.groupId);
    expect(await consentsOf(plain.joiner.user.id)).toEqual([
      expect.objectContaining({
        inviteId: plain.invite.id,
        consentAttestedBy: null,
        consentAttestedAt: null,
        consentAttestedVersion: null,
      }),
    ]);

    const at = new Date(Date.now() - 60_000).toISOString();
    const attested = await joinByLink(s.owner, s.admin, s.groupId, { by: s.owner.user.id, at });
    const [consent] = await consentsOf(attested.joiner.user.id);
    expect(consent).toMatchObject({
      consentAttestedBy: s.owner.user.id,
      consentAttestedVersion: "attested-v0",
    });
    expect(Date.parse(consent!.consentAttestedAt!)).toBe(Date.parse(at));
  });

  it("the migration's backfill fills existing rows from their invites", async () => {
    const migration = readFileSync(new URL("../db/migrations/0052_evidence_survives.sql", import.meta.url), "utf8");
    const backfill = migration
      .split("--> statement-breakpoint")
      .map((statement) => statement.replace(/^\s*--.*$/gm, "").trim())
      .filter((statement) => statement.startsWith("UPDATE"));
    expect(backfill).toHaveLength(1);

    const s = await setup();
    const email = await joinByEmail(s.admin, s.groupId);
    const link = await joinByLink(s.owner, s.admin, s.groupId);
    // As rows written before the migration are: no attestation yet.
    for (const userId of [email.joiner.user.id, link.joiner.user.id]) {
      await getDb()
        .update(careGroupConsentSchema)
        .set({ consentAttestedBy: null, consentAttestedAt: null, consentAttestedVersion: null })
        .where(eq(careGroupConsentSchema.userId, userId));
    }

    await getDb().execute(sql.raw(backfill[0]!));

    const [byEmail] = await consentsOf(email.joiner.user.id);
    expect(byEmail).toMatchObject({
      consentAttestedBy: s.admin.user.id,
      consentAttestedAt: email.invite.consentAttestedAt,
      consentAttestedVersion: CONSENT_VERSION,
    });
    const [byLink] = await consentsOf(link.joiner.user.id);
    expect(byLink).toMatchObject({ consentAttestedBy: null, consentAttestedAt: null });
  });
});

describe("deleting an account or a group", () => {
  /** A registered client and a grant for `who` in the group. */
  const connect = async (who: { ctx: Parameters<typeof connectorGrantService.grant>[0] }, groupId: string) => {
    const clientId = `client-${randomUUID()}`;
    const redirectUri = "https://assistant.example.com/oauth/callback";
    await getDb()
      .insert(oauthClientSchema)
      .values({
        clientId,
        name: "Test Assistant",
        redirectUris: [redirectUri],
        tokenEndpointAuthMethod: "none",
        scopes: ["group:read", "group:write", "offline_access"],
      });
    ok(
      await careGroupService.update(system, {
        filter: { id: { type: "eq", value: groupId } },
        data: { connectorsEnabled: true },
      }),
    );
    ok(await connectorGrantService.grant(who.ctx, { clientId, groupId, scope: "read", redirectUri }));
  };

  it("a deleted user keeps their consent, legal acceptance and audit rows by bare id; grants go", async () => {
    const s = await setup();
    const { joiner } = await joinByEmail(s.admin, s.groupId);
    await connect(joiner, s.groupId);
    ok(
      await adminAuditService.record(undefined, {
        actorId: s.staff.user.id,
        action: "user.view",
        targetUserId: joiner.user.id,
        targetGroupId: s.groupId,
      }),
    );
    const id = joiner.user.id;

    ok(await userService.remove(system, { filter: { id: { type: "eq", value: id } } }));
    expect(ok(await userService.getWholeById(system, id))).toBeNull();

    const db = getDb();
    expect(await consentsOf(id)).toHaveLength(1);
    expect(await db.select().from(legalAcceptanceSchema).where(eq(legalAcceptanceSchema.userId, id))).toHaveLength(
      1,
    );
    expect(
      await db.select().from(adminAuditLogSchema).where(eq(adminAuditLogSchema.targetUserId, id)),
    ).toMatchObject([{ targetUserId: id, targetGroupId: s.groupId, action: "user.view" }]);
    expect(await db.select().from(connectorGrantSchema).where(eq(connectorGrantSchema.userId, id))).toHaveLength(0);
  });

  it("a deleted group keeps its consent rows with the attestation; its invites go", async () => {
    const s = await setup();
    const { joiner } = await joinByEmail(s.admin, s.groupId);
    await connect(s.owner, s.groupId);
    const [before] = await consentsOf(joiner.user.id);

    ok(await careGroupService.remove(system, { filter: { id: { type: "eq", value: s.groupId } } }));

    const db = getDb();
    const kept = await db
      .select()
      .from(careGroupConsentSchema)
      .where(eq(careGroupConsentSchema.groupId, s.groupId));
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({
      userId: joiner.user.id,
      consentAttestedBy: s.admin.user.id,
      consentAttestedAt: before!.consentAttestedAt,
      consentAttestedVersion: CONSENT_VERSION,
    });
    expect(
      await db.select().from(careGroupInviteSchema).where(eq(careGroupInviteSchema.groupId, s.groupId)),
    ).toHaveLength(0);
    expect(
      await db.select().from(connectorGrantSchema).where(eq(connectorGrantSchema.groupId, s.groupId)),
    ).toHaveLength(0);
  });

  it("an orphaned row is the system's: members can't read it, staff with audit.read read the log", async () => {
    const s = await setup();
    const { joiner } = await joinByEmail(s.admin, s.groupId);
    const [consent] = await consentsOf(joiner.user.id);
    ok(
      await adminAuditService.record(undefined, {
        actorId: s.staff.user.id,
        action: "group.view",
        targetGroupId: s.groupId,
      }),
    );
    const groupFilter = { filter: { groupId: { type: "eq" as const, value: s.groupId } } };
    expect(ok(await careGroupConsentService.list(s.owner.ctx, groupFilter)).count).toBe(1);

    ok(await careGroupService.remove(system, { filter: { id: { type: "eq", value: s.groupId } } }));

    // The group's former managers no longer match a group rule.
    for (const who of [s.owner, s.admin, s.caretaker, s.staff]) {
      expect(ok(await careGroupConsentService.list(who.ctx, groupFilter)).count).toBe(0);
      expect(ok(await careGroupConsentModel.getById(consent!.id, who.ctx))).toBeNull();
    }
    expect(ok(await careGroupConsentModel.getById(consent!.id, system))).not.toBeNull();

    // A deleted account's legal acceptance has no owner left.
    const legal = await getDb()
      .select()
      .from(legalAcceptanceSchema)
      .where(eq(legalAcceptanceSchema.userId, joiner.user.id));
    ok(await userService.remove(system, { filter: { id: { type: "eq", value: joiner.user.id } } }));
    for (const who of [s.owner, s.staff]) {
      expect(ok(await legalAcceptanceModel.getById(legal[0]!.id, who.ctx))).toBeNull();
    }
    expect(ok(await legalAcceptanceModel.getById(legal[0]!.id, system))).not.toBeNull();

    // The audit log: staff with audit.read still find the entry by the bare id; members are refused.
    const page = { page: 1, limit: 10 };
    const found = ok(await adminAuditService.list(s.staff.ctx, { target: s.groupId }, page));
    expect(found.data).toEqual([
      expect.objectContaining({ action: "group.view", targetGroup: { id: s.groupId, name: null } }),
    ]);
    expect(await adminAuditService.list(s.owner.ctx, { target: s.groupId }, page)).toMatchObject({
      code: expect.any(String),
    });
  });
});
