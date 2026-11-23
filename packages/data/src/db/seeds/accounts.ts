import { hashPassword, verifyPassword } from "better-auth/crypto";
import { and, eq, inArray, like } from "drizzle-orm";
import { getDb } from "../client";
import { accountSchema, userSchema } from "../schema";
import { USERS } from "./users";

/**
 * Email + password sign-in for every dev user, all sharing SEED_USER_PASSWORD
 * (see .env.example). Hashed with Better Auth's own hasher so sign-in works.
 * Skipped, with a warning, when the variable isn't set.
 */
/**
 * The seed's one hash of `password`, shared by every seeded account (they all
 * have the same password anyway). Better Auth's scrypt is pure JS and
 * CPU-bound, so hashing once per run, not once per seed file, keeps a whole
 * seed fast on a busy machine (B-466).
 */
const hashes = new Map<string, Promise<string>>();
export const seedPasswordHash = (password: string) => {
  let hash = hashes.get(password);
  if (!hash) {
    hash = hashPassword(password);
    hash.catch(() => hashes.delete(password));
    hashes.set(password, hash);
  }
  return hash;
};

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

  const hash = await seedPasswordHash(password);
  await db
    .insert(accountSchema)
    // Better Auth's credential accounts use the user id as accountId.
    .values(users.map((u) => ({ userId: u.id, providerId: "credential", accountId: u.id, password: hash })))
    .onConflictDoNothing({ target: [accountSchema.providerId, accountSchema.accountId] });
};

/** Every seeded account's address is here (the seeds are fictional). */
export const SEEDED_DOMAIN = "@example.com";

/**
 * Staging only (`APP_ENV=staging`; hosting slice 9, B-160): every seeded
 * (`@example.com`) password account whose password isn't the current
 * SEED_USER_PASSWORD gets the new hash, and nothing else changes, so
 * rotating the secret and re-running the seed rotates the accounts. A second
 * run changes nothing. Elsewhere (dev) existing accounts are left alone.
 * `emails` narrows it (tests); by default every seeded address.
 */
export const rotateStagingPasswords = async ({
  env = process.env,
  emails,
}: { env?: { APP_ENV?: string; SEED_USER_PASSWORD?: string }; emails?: string[] } = {}) => {
  const password = env.SEED_USER_PASSWORD;
  if (env.APP_ENV?.trim() !== "staging" || !password) return { updated: 0 };

  const db = getDb();
  const accounts = await db
    .select({ id: accountSchema.id, password: accountSchema.password })
    .from(accountSchema)
    .innerJoin(userSchema, eq(userSchema.id, accountSchema.userId))
    .where(
      and(
        eq(accountSchema.providerId, "credential"),
        like(userSchema.email, `%${SEEDED_DOMAIN}`),
        emails ? inArray(userSchema.email, emails) : undefined,
      ),
    );

  // Seeded accounts share a hash (`seedPasswordHash`): verify each distinct one once.
  const current = new Map<string, Promise<boolean>>();
  const isCurrent = (stored: string) => {
    let ok = current.get(stored);
    if (!ok) current.set(stored, (ok = verifyPassword({ hash: stored, password })));
    return ok;
  };
  let hash: string | undefined;
  let updated = 0;
  for (const account of accounts) {
    if (account.password && (await isCurrent(account.password))) continue;
    hash ??= await seedPasswordHash(password);
    await db
      .update(accountSchema)
      .set({ password: hash, updatedAt: new Date() })
      .where(eq(accountSchema.id, account.id));
    updated++;
  }
  return { updated };
};
