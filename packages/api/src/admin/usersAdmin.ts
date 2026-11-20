import { staffAccountMailer } from "@caretook/auth";
import {
  accountAdminService,
  accountHelpZSchema,
  accountSearchZSchema,
  revokeSessionZSchema,
  setRoleZSchema,
} from "@caretook/data";
import { deliverSoon } from "@caretook/notifications";
import { z } from "zod";
import { iso } from "../dto";
import { unwrap } from "../errors";
import { staffProcedure } from "../procedures";

// `admin.users.*` (admin PRD, slice 2): accounts for Caretook staff. Reads
// need `users.read`; resending verification, sending a reset and signing
// sessions out need `users.help` and a reason (admin and support). Results
// are named fields only: an account, how it signs in, its sessions, its
// groups by name and role, and the mail sent to it by template and status.
// Never care data, an email's data or body, or a session's token.
// Disabling, re-enabling and staff roles (slice 3) need `users.disable` and
// `users.setRole` (admins only) and a reason.

const optionalIso = (value: string | null) => (value ? iso(value) : null);

export const usersAdmin = {
  /** One page of the accounts whose name or email contains `q`, newest first, and how many match. */
  search: staffProcedure("users.read")
    .input(accountSearchZSchema)
    .handler(async ({ context, input }) => {
      const res = unwrap(await accountAdminService.search(context, input));
      return {
        count: res.count,
        page: res.page,
        pageSize: res.pageSize,
        users: res.data.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
          role: user.role,
          createdAt: iso(user.createdAt),
          disabled: user.disabledAt !== null,
        })),
      };
    }),

  /** An account's page (records `user.view`). */
  get: staffProcedure("users.read")
    .input(z.object({ userId: z.uuid() }))
    .handler(async ({ context, input }) => {
      const res = unwrap(await accountAdminService.get(context, input.userId));
      const { account } = res;
      return {
        account: {
          id: account.id,
          name: account.name,
          email: account.email,
          emailVerified: account.emailVerified,
          role: account.role,
          createdAt: iso(account.createdAt),
          disabledAt: optionalIso(account.disabledAt),
          disabledBy: account.disabledBy,
          disabledReason: account.disabledReason,
        },
        signIn: {
          password: res.hasPassword,
          /** The emailed link and code work for every account. */
          emailed: true,
          lastSignInAt: res.sessions.reduce<string | null>((latest, s) => {
            const at = s.createdAt.toISOString();
            return !latest || at > latest ? at : latest;
          }, null),
        },
        sessions: res.sessions.map((s) => ({
          id: s.id,
          userAgent: s.userAgent,
          ipAddress: s.ipAddress,
          createdAt: s.createdAt.toISOString(),
          lastActiveAt: s.updatedAt.toISOString(),
          expiresAt: s.expiresAt.toISOString(),
        })),
        groups: res.groups.map((g) => ({
          groupId: g.groupId,
          displayName: g.displayName,
          groupName: g.groupName,
          role: g.role,
          joinedAt: iso(g.joinedAt),
          invitedBy: g.invitedBy,
        })),
        mail: res.mail.map((m) => ({
          id: m.id,
          template: m.name,
          status: m.status,
          attempts: m.attempts,
          queuedAt: iso(m.createdAt),
          sentAt: optionalIso(m.sentAt),
          errorCode: m.errorCode,
        })),
      };
    }),

  /** Queue a new verification email (an unconfirmed address only). */
  resendVerification: staffProcedure("users.help")
    .input(accountHelpZSchema)
    .handler(async ({ context, input }) => {
      const res = unwrap(
        await accountAdminService.resendVerification(context, input, {
          mail: staffAccountMailer(context.authUser.id),
        }),
      );
      deliverSoon(res.queued);
      return { sent: true };
    }),

  /** Queue a password reset email. */
  sendReset: staffProcedure("users.help")
    .input(accountHelpZSchema)
    .handler(async ({ context, input }) => {
      const res = unwrap(
        await accountAdminService.sendReset(context, input, {
          mail: staffAccountMailer(context.authUser.id),
        }),
      );
      deliverSoon(res.queued);
      return { sent: true };
    }),

  /** Sign one session out. */
  revokeSession: staffProcedure("users.help")
    .input(revokeSessionZSchema)
    .handler(async ({ context, input }) => unwrap(await accountAdminService.revokeSession(context, input))),

  /** Sign every session out; returns how many there were. */
  revokeAllSessions: staffProcedure("users.help")
    .input(accountHelpZSchema)
    .handler(async ({ context, input }) =>
      unwrap(await accountAdminService.revokeAllSessions(context, input)),
    ),

  /** Disable an account: every session signed out, no sign-in or tokens until re-enabled. */
  disable: staffProcedure("users.disable")
    .input(accountHelpZSchema)
    .handler(async ({ context, input }) => unwrap(await accountAdminService.disable(context, input))),

  /** Re-enable a disabled account. */
  enable: staffProcedure("users.disable")
    .input(accountHelpZSchema)
    .handler(async ({ context, input }) => unwrap(await accountAdminService.enable(context, input))),

  /** Make an account support or admin, or a member again. */
  setRole: staffProcedure("users.setRole")
    .input(setRoleZSchema)
    .handler(async ({ context, input }) => unwrap(await accountAdminService.setRole(context, input))),
};
