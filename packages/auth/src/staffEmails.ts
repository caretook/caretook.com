import type { AccountMailer } from "@caretook/data";

import { notify } from "@caretook/notifications";
import { createEmailVerificationToken } from "better-auth/api";
import { randomInt, randomUUID } from "node:crypto";
import { getAuth } from "./auth";
import { keyFor } from "./emails";

// The auth emails staff send from an account's page (admin PRD, slice 2):
// the same verification and reset emails Better Auth sends, with tokens
// made exactly as it makes them, queued in the staff action's transaction
// (accountAdminService), so the email and its audit entry commit together.

const HOUR_S = 60 * 60;
const ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** A reset token shaped like Better Auth's own (24 letters and digits). */
const resetToken = () =>
  Array.from({ length: 24 }, () => ALPHANUMERIC[randomInt(ALPHANUMERIC.length)]).join("");

/** The mailer for `accountAdminService`, sending as `actorId`. */
export const staffAccountMailer = (actorId: string): AccountMailer => ({
  verification: async (user, tx) => {
    const ctx = await getAuth().$context;
    const token = await createEmailVerificationToken(
      ctx.secret,
      user.email,
      undefined,
      ctx.options.emailVerification?.expiresIn ?? HOUR_S,
      { userId: user.id },
    );
    return notify("verifyEmail", {
      to: user.email,
      actor: { id: actorId },
      data: { name: user.name ?? undefined, token },
      idempotencyKey: keyFor("verifyEmail", `${token}:${randomUUID()}`),
      tx,
    });
  },

  reset: async (user, tx) => {
    const ctx = await getAuth().$context;
    const token = resetToken();
    const expiresIn = ctx.options.emailAndPassword?.resetPasswordTokenExpiresIn ?? HOUR_S;
    // Better Auth's own store, so its reset endpoint finds the token.
    await ctx.internalAdapter.createVerificationValue({
      value: user.id,
      identifier: `reset-password:${token}`,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    });
    return notify("resetPassword", {
      to: user.email,
      actor: { id: actorId },
      data: { name: user.name ?? undefined, token },
      idempotencyKey: keyFor("resetPassword", token),
      tx,
    });
  },
});
