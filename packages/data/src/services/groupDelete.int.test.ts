import type { FakeGoogleCalendar } from "../google";

import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createUser, createWorld, ok, system } from "../../test/fixtures";
import { SYSTEM_USER } from "../constants";
import { getDb } from "../db";
import {
  adminAuditLogSchema,
  careGroupConsentSchema,
  connectorGrantSchema,
  googleCalendarConnectionSchema,
  notificationOutboxSchema,
  oauthClientSchema,
  oauthConsentSchema,
} from "../db/schema";
import { isError } from "../errors";
import { fakeGoogleCalendar, setCalendarBackgroundRunner, setGoogleCalendarClient } from "../google";
import {
  careGroupInviteService,
  careGroupService,
  connectorGrantService,
  googleConnectionService,
  providerService,
  timelineEntryService,
  todoService,
  userService,
} from ".";

// Deleting a care group (data-rights slice 6): `careGroupService.remove`,
// an owner typing the group's name. Everything in the group goes; the
// evidence (consent, the audit log) stays by bare id; assistants and Google
// are cut off; waiting mail is skipped. Names and addresses are made up.

let google: FakeGoogleCalendar;
let pending: Promise<unknown>[] = [];
/** Wait for the work started after a commit (Google's revoke). */
const settled = async () => {
  while (pending.length) {
    const batch = pending;
    pending = [];
    await Promise.all(batch);
  }
};

beforeAll(() => setCalendarBackgroundRunner((work) => pending.push(work)));
afterAll(() => {
  setCalendarBackgroundRunner(null);
  setGoogleCalendarClient(undefined);
});
beforeEach(() => {
  google = fakeGoogleCalendar();
  setGoogleCalendarClient(google);
  pending = [];
});

const codeOf = (res: unknown) => (isError(res) ? res.code : "ok");
const newAddress = (label: string) => `${label}-${randomUUID().slice(0, 8)}@example.com`;

const setup = async () => {
  const world = await createWorld({ members: ["admin", "caretaker"], extras: ["outsider"] });
  return { ...world, name: world.group.name };
};

/** Every table with a `group_id` column, and how many rows each holds for `groupId`. */
const groupRows = async (groupId: string) => {
  const db = getDb();
  const tables = await db.execute<{ table_name: string }>(sql`
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = current_schema() AND column_name = 'group_id'
    ORDER BY table_name`);
  const counts: Record<string, number> = {};
  for (const { table_name } of tables.rows) {
    const [row] = (
      await db.execute<{ n: number }>(
        sql`SELECT count(*)::int AS n FROM ${sql.identifier(table_name)} WHERE group_id = ${groupId}`,
      )
    ).rows;
    counts[table_name] = row?.n ?? 0;
  }
  return counts;
};

/** An account that accepted an email invite from `inviter`: its consent row is evidence. */
const joinByEmail = async (
  inviter: { ctx: Parameters<typeof careGroupInviteService.createEmail>[0] },
  groupId: string,
) => {
  const email = newAddress("gd-joiner");
  const { token } = ok(
    await careGroupInviteService.createEmail(inviter.ctx, {
      groupId,
      email,
      role: "caretaker",
      attested: true,
    }),
  );
  const user = ok(await userService.create(system, { email, name: "Joiner" }))!;
  const joiner = { user, ctx: { authUser: { id: user.id, roleNames: user.roleNames } } };
  ok(await careGroupInviteService.accept(joiner.ctx, { token, consent: true, legal: true }));
  return joiner;
};

/** A registered assistant connected for `who`, with the plugin's consent row. */
const connectAssistant = async (who: { user: { id: string }; ctx: never }, groupId: string) => {
  const clientId = `client-${randomUUID()}`;
  const redirectUri = "https://assistant.example.com/oauth/callback";
  const scopes = ["group:read", "group:write", "offline_access"];
  await getDb()
    .insert(oauthClientSchema)
    .values({
      clientId,
      name: "Test Assistant",
      redirectUris: [redirectUri],
      tokenEndpointAuthMethod: "none",
      scopes,
    });
  ok(
    await careGroupService.update(system, {
      filter: { id: { type: "eq", value: groupId } },
      data: { connectorsEnabled: true },
    }),
  );
  ok(await connectorGrantService.grant(who.ctx, { clientId, groupId, scope: "read", redirectUri }));
  await getDb()
    .insert(oauthConsentSchema)
    .values({ clientId, userId: who.user.id, scopes, createdAt: new Date(), updatedAt: new Date() });
  return clientId;
};

/** Connect `who`'s Google Calendar for the group through the fake. */
const connectGoogle = async (who: { ctx: never }, groupId: string, refreshToken: string) => {
  const started = ok(await googleConnectionService.start(who.ctx, groupId));
  const state = new URL(started.url).searchParams.get("state")!;
  const code = google.grant({ refreshToken });
  ok(await googleConnectionService.complete(who.ctx, { code, state }));
  await settled();
  pending = [];
};

/** A waiting email. */
const queueMail = async (idempotencyKey: string, text = "Hello") => {
  const [row] = await getDb()
    .insert(notificationOutboxSchema)
    .values({
      name: "testMessage",
      recipient: newAddress("gd-mail"),
      subject: "A message",
      html: `<p>${text}</p>`,
      text,
      idempotencyKey,
      createdBy: SYSTEM_USER.id,
      updatedBy: SYSTEM_USER.id,
    })
    .returning();
  return row!.id;
};
const mailState = async (id: string) => {
  const [row] = await getDb()
    .select({ status: notificationOutboxSchema.status, lastError: notificationOutboxSchema.lastError })
    .from(notificationOutboxSchema)
    .where(eq(notificationOutboxSchema.id, id));
  return row;
};

describe("deleting a care group", () => {
  it("empties every care table for the group and its invites; consent and the audit entry stay", async () => {
    const { u, groupId, name } = await setup();
    const joiner = await joinByEmail(u.admin, groupId);
    ok(
      await careGroupInviteService.createEmail(u.owner.ctx, {
        groupId,
        email: newAddress("gd-waiting"),
        role: "viewer",
        attested: true,
      }),
    );
    ok(
      await timelineEntryService.create(u.caretaker.ctx, {
        groupId,
        kind: "note",
        title: "Ate lunch",
        occurredAt: "2026-11-17T12:00:00-08:00",
        timeZone: "America/Los_Angeles",
      }),
    );
    ok(await todoService.create(u.owner.ctx, { groupId, title: "Refill the pill box" }));
    ok(await providerService.create(u.owner.ctx, { groupId, type: "clinician", name: "Dr. Example" }));
    const before = await groupRows(groupId);
    expect(before.care_group_invite).toBeGreaterThan(0);
    expect(before.timeline_entry).toBeGreaterThan(0);

    expect(
      codeOf(await careGroupService.remove(u.owner.ctx, { groupId, confirmName: ` ${name.toUpperCase()} ` })),
    ).toBe("ok");

    const after = await groupRows(groupId);
    // The evidence keeps its bare id; everything else is gone.
    const { care_group_consent: consents, ...rest } = after;
    expect(Object.entries(rest).filter(([, n]) => n > 0)).toEqual([]);
    expect(consents).toBe(1);
    expect(
      await getDb()
        .select()
        .from(careGroupConsentSchema)
        .where(eq(careGroupConsentSchema.userId, joiner.user.id)),
    ).toHaveLength(1);
    const audit = await getDb()
      .select()
      .from(adminAuditLogSchema)
      .where(
        and(eq(adminAuditLogSchema.targetGroupId, groupId), eq(adminAuditLogSchema.action, "group.deleted")),
      );
    expect(audit).toEqual([
      expect.objectContaining({ actorId: u.owner.user.id, targetUserId: null, reason: null, changes: {} }),
    ]);
  });

  it("revokes every assistant grant, with its tokens and consent", async () => {
    const { u, groupId, name } = await setup();
    const clientId = await connectAssistant(u.caretaker as never, groupId);
    ok(await careGroupService.remove(u.owner.ctx, { groupId, confirmName: name }));
    expect(
      await getDb().select().from(connectorGrantSchema).where(eq(connectorGrantSchema.groupId, groupId)),
    ).toEqual([]);
    expect(
      await getDb()
        .select()
        .from(oauthConsentSchema)
        .where(
          and(eq(oauthConsentSchema.userId, u.caretaker.user.id), eq(oauthConsentSchema.clientId, clientId)),
        ),
    ).toEqual([]);
  });

  it("revokes every member's Google connection once it commits", async () => {
    const { u, groupId, name } = await setup();
    await connectGoogle(u.owner as never, groupId, "1//fake-refresh-owner");
    await connectGoogle(u.caretaker as never, groupId, "1//fake-refresh-caretaker");

    ok(await careGroupService.remove(u.owner.ctx, { groupId, confirmName: name }));
    // Revoked once the deletion commits, in the background.
    await settled();
    expect(google.revoked().sort()).toEqual(["1//fake-refresh-caretaker", "1//fake-refresh-owner"]);
    expect(
      await getDb()
        .select()
        .from(googleCalendarConnectionSchema)
        .where(eq(googleCalendarConnectionSchema.groupId, groupId)),
    ).toEqual([]);
  });

  it("still deletes the group when Google fails", async () => {
    const { u, groupId, name } = await setup();
    await connectGoogle(u.admin as never, groupId, "1//fake-refresh-admin");
    google.failCalls(true);
    expect(codeOf(await careGroupService.remove(u.owner.ctx, { groupId, confirmName: name }))).toBe("ok");
    await settled();
    expect(google.revoked()).toEqual([]);
    expect(await careGroupService.getById(system, groupId)).toBeNull();
  });

  it("skips the group's waiting mail with groupDeleted, and leaves other mail and sent mail alone", async () => {
    const { u, groupId, name } = await setup();
    const { invite } = ok(
      await careGroupInviteService.createEmail(u.owner.ctx, {
        groupId,
        email: newAddress("gd-invitee"),
        role: "viewer",
        attested: true,
      }),
    );
    const reminder = await queueMail(`reminder:${u.caretaker.user.id}:${groupId}:entry:${randomUUID()}:60:x`);
    const linked = await queueMail(
      `joinApproved:${randomUUID()}:x`,
      `Open https://app.example.com/app/groups/${groupId}`,
    );
    const invited = await queueMail(`groupInvite:${invite.id}:hash`);
    const other = await queueMail(`groupInvite:${randomUUID()}:hash`, "/app/groups/" + randomUUID());
    const sent = await queueMail(`reminder:${u.owner.user.id}:${groupId}:todo:${randomUUID()}:60:x`);
    await getDb()
      .update(notificationOutboxSchema)
      .set({ status: "sent" })
      .where(eq(notificationOutboxSchema.id, sent));

    ok(await careGroupService.remove(u.owner.ctx, { groupId, confirmName: name }));

    for (const id of [reminder, linked, invited])
      expect(await mailState(id)).toEqual({ status: "skipped", lastError: "groupDeleted" });
    expect(await mailState(other)).toEqual({ status: "pending", lastError: null });
    expect(await mailState(sent)).toEqual({ status: "sent", lastError: null });
  });

  it("refuses an admin, a caretaker, an outsider and a wrong name, and changes nothing", async () => {
    const { u, groupId, name } = await setup();
    const waiting = await queueMail(`reminder:${u.owner.user.id}:${groupId}:entry:${randomUUID()}:60:x`);
    const stranger = await createUser("gd-stranger");
    expect(codeOf(await careGroupService.remove(u.admin.ctx, { groupId, confirmName: name }))).toBe(
      "careGroupService:ownerOnly",
    );
    expect(codeOf(await careGroupService.remove(u.caretaker.ctx, { groupId, confirmName: name }))).toBe(
      "careGroupService:ownerOnly",
    );
    for (const who of [u.outsider, stranger])
      expect(codeOf(await careGroupService.remove(who.ctx, { groupId, confirmName: name }))).toBe(
        "careGroupService:notFound",
      );
    for (const confirmName of ["", "Another Family", `${name} 2`])
      expect(codeOf(await careGroupService.remove(u.owner.ctx, { groupId, confirmName }))).toBe(
        "careGroupService:wrongName",
      );
    expect(await careGroupService.getById(system, groupId)).toMatchObject({ id: groupId });
    expect(await mailState(waiting)).toEqual({ status: "pending", lastError: null });
    expect(
      await getDb().select().from(adminAuditLogSchema).where(eq(adminAuditLogSchema.targetGroupId, groupId)),
    ).toEqual([]);
  });
});
