import type { InviteMailer } from "@caretook/data";

import { createHash } from "node:crypto";
import { signUpWithTicket } from "@caretook/auth";
import {
  accessCodeCreateZSchema,
  accessCodeService,
  careGroupService,
  codeState,
  inviteEmailZ,
  newCareGroupZSchema,
  normalizeInviteEmail,
  timeZoneZSchema,
  resolveNewCareGroup,
  staffGroupService,
} from "@caretook/data";
import { deliverSoon, notify } from "@caretook/notifications";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { iso } from "../dto";
import { unwrap } from "../errors";
import { authedProcedure, publicProcedure, staffProcedure } from "../procedures";

// Starting care groups (invites slice 5): `careGroup.create` for anyone
// signed in, `accessCode.*` for people starting one from a staff code, and
// `admin.*` for Caretook staff (access codes, and a group with an owner
// invite). Admin procedures return codes, labels, counts and the names staff
// typed in: never a group's care data.

const id = z.uuid();
/** What someone types or scans; normalized by the service. */
const codeInput = z.string().trim().min(1).max(40);

const hashed = (value: string) => createHash("sha256").update(value).digest("base64url");

/**
 * Start a care group: the group, its care recipient and the creator as its
 * owner, in one transaction. The group name defaults to "<name>'s care".
 */
export const createCareGroup = authedProcedure
  .input(newCareGroupZSchema)
  .handler(async ({ context, input }) => {
    const { name, recipient } = resolveNewCareGroup(input);
    const created = unwrap(await careGroupService.create(context, { name, recipient }));
    if (!created.group) throw new ORPCError("INTERNAL_SERVER_ERROR");
    return { groupId: created.group.id, name: created.group.name };
  });

export const accessCode = {
  /** Whether a code works: `usable`, `expired`, `revoked`, `usedUp` or `notFound`. Nothing else about it. */
  preview: publicProcedure.input(z.object({ code: codeInput })).handler(async ({ input }) => {
    const found = unwrap(await accessCodeService.preview(input.code));
    return found.state === "usable" ? { state: found.state, code: found.code } : { state: found.state };
  }),

  /**
   * Create an account and its care group from a code, in one transaction.
   * The account isn't verified yet: the client asks for the confirmation
   * email and sends the person to /verify-email. An address that already
   * has an account gets the same answer (and an email instead), so the
   * answer is only the address, never the new group's id.
   */
  signUp: publicProcedure
    .input(
      z.object({
        code: codeInput,
        name: z.string().trim().min(1).max(100),
        email: z.email().max(254),
        password: z.string().min(1).max(256),
        group: newCareGroupZSchema,
        legal: z.literal(true),
      }),
    )
    .handler(async ({ input }) => {
      unwrap(
        await signUpWithTicket({
          ticket: { kind: "accessCode", code: input.code, group: input.group, legal: input.legal },
          name: input.name,
          email: input.email,
          password: input.password,
        }),
      );
      return { email: normalizeInviteEmail(input.email) };
    }),
};

/** A code as staff see it. */
const toAccessCode = (row: {
  id: string;
  code: string;
  label: string;
  expiresAt: string;
  maxUses: number | null;
  useCount: number;
  revokedAt: string | null;
  createdAt: string;
}) => ({
  id: row.id,
  code: row.code,
  label: row.label,
  expiresAt: iso(row.expiresAt),
  maxUses: row.maxUses,
  useCount: row.useCount,
  revokedAt: row.revokedAt ? iso(row.revokedAt) : null,
  createdAt: iso(row.createdAt),
  state: codeState({ code: row }),
});

export type AccessCodeDto = ReturnType<typeof toAccessCode>;

/** Queues `ownerInvite` in the service's transaction. */
const ownerInviteMailer =
  (actorId: string): InviteMailer =>
  ({ invite, token, groupName }, tx) => {
    if (!invite.email) throw new Error("An email invite without an email");
    return notify("ownerInvite", {
      to: invite.email,
      actor: { id: actorId },
      data: { groupName, token },
      idempotencyKey: `ownerInvite:${invite.id}:${hashed(token)}`,
      tx,
    });
  };

export const admin = {
  accessCode: {
    /** Every code, newest first, with its uses. */
    list: staffProcedure("accessCodes.write").handler(async ({ context }) =>
      unwrap(await accessCodeService.list(context)).map(toAccessCode),
    ),
    get: staffProcedure("accessCodes.write")
      .input(z.object({ id }))
      .handler(async ({ context, input }) => {
        const row = unwrap(await accessCodeService.getById(context, input.id));
        if (!row) throw new ORPCError("NOT_FOUND");
        return toAccessCode(row);
      }),
    create: staffProcedure("accessCodes.write")
      .input(accessCodeCreateZSchema)
      .handler(async ({ context, input }) => {
        const row = unwrap(await accessCodeService.create(context, input));
        if (!row) throw new ORPCError("INTERNAL_SERVER_ERROR");
        return toAccessCode(row);
      }),
    revoke: staffProcedure("accessCodes.write")
      .input(z.object({ id }))
      .handler(async ({ context, input }) =>
        toAccessCode(unwrap(await accessCodeService.revoke(context, input.id))),
      ),
  },
  careGroup: {
    /**
     * A group with its recipient and no members, and an owner invite to
     * `ownerEmail` (the `ownerInvite` email). The staff member doesn't join it.
     */
    createWithOwnerInvite: staffProcedure("staffGroups.create")
      .input(
        z.object({
          groupName: z.string().trim().min(1, "Enter the group's name").max(120),
          recipientName: z.string().trim().min(1, "Enter the care recipient's name").max(120),
          ownerEmail: inviteEmailZ,
          timeZone: timeZoneZSchema.nullish(),
          attested: z.literal(true),
        }),
      )
      .handler(async ({ context, input }) => {
        const created = unwrap(
          await staffGroupService.createWithOwnerInvite(context, input, {
            mail: ownerInviteMailer(context.authUser.id),
          }),
        );
        if (created.queued) deliverSoon(created.queued);
        return { groupId: created.groupId, groupName: created.groupName, ownerEmail: input.ownerEmail };
      }),
  },
};
