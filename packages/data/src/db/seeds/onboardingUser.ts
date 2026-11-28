import { eq } from "drizzle-orm";
import { SYSTEM_USER } from "../../constants";
import { getDbConfig } from "../../config";
import { newError } from "../../errors";
import { dbMayFail, getDb } from "../client";
import { accountSchema, careGroupSchema, userSchema } from "../schema";
import { seedPasswordHash } from "./accounts";
import { seedRefusal } from "./guard";

// The onboarding test account (B-667): signed up, in no group, nothing set
// up, so signing in starts the creator's setup flow (B-670: only a group's
// creator gets it). Outside the seeded dismissal (`setupDismissed.ts`) and,
// on staging, `realOwners.ts`, so a group it creates stays its own and
// unfinished. `datastore:reset:onboarding` puts it back to before first
// login. Own id (…3f1d2b7a…). Fictional, like every seed.

export const ONBOARDING_EMAIL = "onboarding@example.com";
export const ONBOARDING_USER_ID = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b7a0001";

const seedAudits = { createdBy: SYSTEM_USER.id, updatedBy: SYSTEM_USER.id };

/** The account and its password sign-in (when `SEED_USER_PASSWORD` is set). Idempotent. */
export const seed = async () => {
  const db = getDb();
  await db
    .insert(userSchema)
    .values({
      id: ONBOARDING_USER_ID,
      email: ONBOARDING_EMAIL,
      name: "Dev Onboarding",
      role: "member",
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
      userId: ONBOARDING_USER_ID,
      providerId: "credential",
      accountId: ONBOARDING_USER_ID,
      password: await seedPasswordHash(password),
    })
    .onConflictDoNothing({ target: [accountSchema.providerId, accountSchema.accountId] });
};

/**
 * Back to before first login: deletes the groups the account created (their
 * rows go with them, ON DELETE CASCADE), then the account itself (its
 * preferences and setup state, sign-ins, sessions and memberships cascade),
 * then seeds it again with the same id. Only that account's own rows; behind
 * the seed guard (`seedRefusal`), so only a local database or staging.
 */
export const reset = async () => {
  const refusal = seedRefusal({ ...process.env, DATABASE_URL: getDbConfig().url });
  if (refusal) return newError({ code: refusal });

  return dbMayFail(async () => {
    const { groups } = await getDb().transaction(async (tx) => {
      const gone = await tx
        .delete(careGroupSchema)
        .where(eq(careGroupSchema.createdBy, ONBOARDING_USER_ID))
        .returning({ id: careGroupSchema.id });
      await tx.delete(userSchema).where(eq(userSchema.id, ONBOARDING_USER_ID));
      return { groups: gone.length };
    });
    await seed();
    return { groups };
  }, "db:reset:onboarding");
};
