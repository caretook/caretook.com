import type { Tx } from "../db";

import { createHash } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { normalizeInviteEmail, verificationSchema } from "../db/schema";

// A link's sign-up counts toward its `max_uses` (account-security slice 2,
// B-333), so one link can't mint unlimited accounts. The person then asks to
// join through the same link; that request mustn't count them again. The
// sign-up leaves this marker (a `verification` row, Better Auth's short-lived
// key-value table: no migration), keyed on the link and the hashed address,
// expiring with the link. The join request takes it instead of counting.

const identifierFor = (inviteId: string, email: string) =>
  `link-signup:${inviteId}:${createHash("sha256").update(normalizeInviteEmail(email)).digest("base64url")}`;

/** Whether `email`'s sign-up through link `inviteId` already counted a use (and it hasn't been taken). */
export const hasSignUpUse = async (tx: Tx, inviteId: string, email: string) => {
  const [row] = await tx
    .select({ id: verificationSchema.id })
    .from(verificationSchema)
    .where(
      and(
        eq(verificationSchema.identifier, identifierFor(inviteId, email)),
        gt(verificationSchema.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return Boolean(row);
};

/** Record that `email`'s sign-up through link `inviteId` counted a use, until `expiresAt`. */
export const markSignUpUse = async (tx: Tx, inviteId: string, email: string, expiresAt: string) => {
  await tx
    .insert(verificationSchema)
    .values({ identifier: identifierFor(inviteId, email), value: "1", expiresAt: new Date(expiresAt) });
};

/** Take the sign-up's use for the join request: true when there was one (the request then counts none). */
export const takeSignUpUse = async (tx: Tx, inviteId: string, email: string) => {
  const taken = await tx
    .delete(verificationSchema)
    .where(
      and(
        eq(verificationSchema.identifier, identifierFor(inviteId, email)),
        gt(verificationSchema.expiresAt, new Date()),
      ),
    )
    .returning({ id: verificationSchema.id });
  return taken.length > 0;
};
