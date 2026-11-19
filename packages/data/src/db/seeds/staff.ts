import { hashPassword } from "better-auth/crypto";
import { SYSTEM_USER } from "../../constants";
import { getDb } from "../client";
import { accountSchema, userSchema } from "../schema";

// Caretook support staff for /admin (admin PRD): support@example.com, with
// the `support` role and in no care group, beside admin@example.com. Own id
// (…3f1d2b8a…). Fictional, like every seed.

export const SUPPORT_EMAIL = "support@example.com";
export const SUPPORT_USER_ID = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8a0001";

const seedAudits = { createdBy: SYSTEM_USER.id, updatedBy: SYSTEM_USER.id };

export const seed = async () => {
  const db = getDb();
  await db
    .insert(userSchema)
    .values({
      id: SUPPORT_USER_ID,
      email: SUPPORT_EMAIL,
      name: "Dev Support",
      role: "support",
      emailVerified: true,
      ...seedAudits,
    })
    .onConflictDoNothing({ target: userSchema.email });

  const password = process.env.SEED_USER_PASSWORD;
  if (!password) return;
  await db
    .insert(accountSchema)
    // Better Auth's credential accounts use the user id as accountId.
    .values({
      userId: SUPPORT_USER_ID,
      providerId: "credential",
      accountId: SUPPORT_USER_ID,
      password: await hashPassword(password),
    })
    .onConflictDoNothing({ target: [accountSchema.providerId, accountSchema.accountId] });
};
