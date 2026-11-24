import { eq } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { isError } from "../errors";
import { SYSTEM_USER } from "../constants";
import { getDb } from "./client";
import { resetStaging, wipeStaging } from "./resetStaging";
import {
  accountSchema,
  careGroupMemberSchema,
  careGroupSchema,
  DEFAULT_SYMPTOMS,
  symptomKey,
  symptomTypeSchema,
  userSchema,
} from "./schema";
import { DEV_GROUP_ID } from "./seeds/careGroups";

// Reset staging (B-449) against the test database: the wipe keeps real
// sign-ins and nothing else, and the seed that follows makes them owners of
// the seeded groups. Fictional people throughout.

const REAL_EMAIL = "robin.tester@caretook.test";
const audits = { createdBy: SYSTEM_USER.id, updatedBy: SYSTEM_USER.id };

const staging = () => {
  vi.stubEnv("APP_ENV", "staging");
  vi.stubEnv("SEED_USER_PASSWORD", "a-long-fictional-staging-password");
};

const emails = async () =>
  (await getDb().select({ email: userSchema.email }).from(userSchema)).map((u) => u.email);

describe("resetStaging", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // Leave the worker's database as other files expect it: no seed, no users of ours.
  // The wipe also deletes what earlier files left in this worker's database: after
  // search.int.test.ts's 10,000 entries it took ~14 s on a busy machine (B-610).
  afterAll(async () => {
    staging();
    await wipeStaging();
    await getDb().delete(userSchema).where(eq(userSchema.email, REAL_EMAIL));
    vi.unstubAllEnvs();
  }, 60_000);

  it("refuses anywhere but staging, before anything is deleted", async () => {
    const db = getDb();
    const [stray] = await db
      .insert(userSchema)
      .values({ email: "stray-refusal@example.com", name: "Stray", ...audits })
      .returning();

    for (const appEnv of [undefined, "production"]) {
      vi.stubEnv("APP_ENV", appEnv);
      vi.stubEnv("SEED_USER_PASSWORD", "a-long-fictional-staging-password");
      const res = await resetStaging();
      expect(isError(res) && res.code).toBe("db:reset:notStaging");
    }
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("SEED_USER_PASSWORD", "");
    const res = await resetStaging();
    expect(isError(res) && res.code).toBe("db:seed:password");

    expect(await emails()).toContain(stray!.email);
  });

  it("wipes everything but real sign-ins, reseeds, and makes them owners of the seeded groups", async () => {
    staging();
    const db = getDb();
    const [real] = await db
      .insert(userSchema)
      .values({ email: REAL_EMAIL, name: "Robin Tester", role: "admin", emailVerified: true, ...audits })
      .returning();
    await db.insert(accountSchema).values({
      userId: real!.id,
      providerId: "credential",
      accountId: real!.id,
      password: "fictional-hash",
    });
    const [stray] = await db
      .insert(userSchema)
      .values({ email: "stray-wipe@example.com", name: "Stray", ...audits })
      .returning();
    // A group the real account made, and one a seeded account made: both go.
    const [own, theirs] = await db
      .insert(careGroupSchema)
      .values([
        { name: "Robin's test group", createdBy: real!.id, updatedBy: real!.id },
        { name: "Stray's group", createdBy: stray!.id, updatedBy: stray!.id },
      ])
      .returning();
    await db
      .insert(careGroupMemberSchema)
      .values({ groupId: own!.id, userId: real!.id, role: "owner", ...audits });

    const res = await resetStaging();
    expect(isError(res) ? res : null).toBeNull();

    // The real sign-in is intact, staff role and password account included.
    const [kept] = await db.select().from(userSchema).where(eq(userSchema.email, REAL_EMAIL));
    expect(kept).toMatchObject({ id: real!.id, role: "admin" });
    expect(await db.select().from(accountSchema).where(eq(accountSchema.userId, real!.id))).toHaveLength(1);

    // What was there is gone; the seed is back.
    const after = await emails();
    expect(after).not.toContain(stray!.email);
    expect(after).toContain("member@example.com");
    const groups = await db.select({ id: careGroupSchema.id }).from(careGroupSchema);
    const groupIds = groups.map((g) => g.id);
    expect(groupIds).toContain(DEV_GROUP_ID);
    expect(groupIds).not.toContain(own!.id);
    expect(groupIds).not.toContain(theirs!.id);

    // The seed's last step fills the symptom catalog (symptom-catalog slice 1):
    // Dev Family has every default and the names its entries use.
    const catalog = await db
      .select({ key: symptomTypeSchema.nameKey })
      .from(symptomTypeSchema)
      .where(eq(symptomTypeSchema.groupId, DEV_GROUP_ID));
    const keys = catalog.map((r) => r.key);
    expect(keys).toEqual(
      expect.arrayContaining([...DEFAULT_SYMPTOMS.map(symptomKey), "knee pain", "sudden confusion"]),
    );
    expect(new Set(keys).size).toBe(keys.length);

    // The real account owns every group (all of them are seeded now).
    const memberships = await db
      .select({ groupId: careGroupMemberSchema.groupId, role: careGroupMemberSchema.role })
      .from(careGroupMemberSchema)
      .where(eq(careGroupMemberSchema.userId, real!.id));
    expect(memberships.map((m) => m.groupId).sort()).toEqual([...groupIds].sort());
    expect(new Set(memberships.map((m) => m.role))).toEqual(new Set(["owner"]));
    // A whole seed (one scrypt hash and one verify, B-466): ~1.6 s alone, so the default 5 s is too tight
    // on a busy machine.
  }, 60_000);
});
