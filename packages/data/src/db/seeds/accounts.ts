import { hashPassword } from "better-auth/crypto";
import { inArray } from "drizzle-orm";
import { getDb } from "../client";
import { accountSchema, userSchema } from "../schema";
import { USERS } from "./users";

/**
 * Email + password sign-in for every dev user, all sharing SEED_USER_PASSWORD
 * (see .env.example). Hashed with Better Auth's own hasher so sign-in works.
 * Skipped, with a warning, when the variable isn't set.
 */
export const seed = async () => {
  const password = process.env.SEED_USER_PASSWORD;
  if (!password) {
    console.warn("SEED_USER_PASSWORD is not set: skipping dev sign-in accounts");
    return;
  }

  const db = getDb();
  const users = await db
    .select({ id: userSchema.id })
    .from(userSchema)
    .where(
      inArray(
        userSchema.email,
        USERS.map((u) => u.email),
      ),
    );
  if (!users.length) return;

  const hash = await hashPassword(password);
  await db
    .insert(accountSchema)
    // Better Auth's credential accounts use the user id as accountId.
    .values(users.map((u) => ({ userId: u.id, providerId: "credential", accountId: u.id, password: hash })))
    .onConflictDoNothing({ target: [accountSchema.providerId, accountSchema.accountId] });
};
