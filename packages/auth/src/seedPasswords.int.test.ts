import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { describe, expect, it } from "vitest";
import { accountSchema, getDb, userSchema } from "@caretook/data";
import { rotateStagingPasswords } from "../../data/src/db/seeds/accounts";
import { createUser } from "../../data/test/fixtures";
import { getAuth } from ".";

// Staging's seed password rotation (hosting slice 9, B-160): with
// APP_ENV=staging the seed moves seeded (`@example.com`) password accounts
// to the current SEED_USER_PASSWORD, and they sign in with it through Better
// Auth; dev leaves existing accounts alone. Narrowed to this test's accounts
// (the database is shared).

const OLD = "the-old-staging-seed-password";
const NEW = "the-new-staging-seed-password";

const createSeeded = async (email?: string) => {
  const { user } = await createUser("seeded");
  await getDb()
    .update(userSchema)
    .set({ emailVerified: true, ...(email ? { email } : {}) })
    .where(eq(userSchema.id, user.id));
  await getDb()
    .insert(accountSchema)
    .values({
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: await hashPassword(OLD),
    });
  return { id: user.id, email: email ?? user.email };
};

const accountOf = async (userId: string) =>
  (await getDb().select().from(accountSchema).where(eq(accountSchema.userId, userId)))[0];

const signIn = async (email: string, password: string) =>
  (await getAuth().api.signInEmail({ body: { email, password }, asResponse: true })).status;

describe("the seed's staging password rotation", () => {
  it("leaves dev's accounts alone", async () => {
    const seeded = await createSeeded();
    const before = await accountOf(seeded.id);
    const res = await rotateStagingPasswords({ env: { SEED_USER_PASSWORD: NEW }, emails: [seeded.email] });
    expect(res).toEqual({ updated: 0 });
    expect(await accountOf(seeded.id)).toEqual(before);
    expect(await signIn(seeded.email, OLD)).toBe(200);
  }, 20_000);

  it("on staging, moves seeded accounts to the new password, once, and changes nothing else", async () => {
    const seeded = await createSeeded();
    const team = await createSeeded(`team-${randomUUID().slice(0, 8)}@caretook.test`);
    const before = await accountOf(seeded.id);
    const teamBefore = await accountOf(team.id);
    const env = { APP_ENV: "staging", SEED_USER_PASSWORD: NEW };
    const emails = [seeded.email, team.email];

    expect(await rotateStagingPasswords({ env, emails })).toEqual({ updated: 1 });
    expect(await signIn(seeded.email, NEW)).toBe(200);
    expect(await signIn(seeded.email, OLD)).toBe(401);

    const after = await accountOf(seeded.id);
    expect(after?.password).not.toBe(before?.password);
    expect({ ...after, password: null, updatedAt: null }).toEqual({
      ...before,
      password: null,
      updatedAt: null,
    });
    // Not a seeded address: untouched.
    expect(await accountOf(team.id)).toEqual(teamBefore);

    // Idempotent: a second run finds the password current.
    expect(await rotateStagingPasswords({ env, emails })).toEqual({ updated: 0 });
    expect(await accountOf(seeded.id)).toEqual(after);
  }, 20_000);
});
