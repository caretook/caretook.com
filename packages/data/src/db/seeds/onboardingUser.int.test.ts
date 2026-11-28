import { eq, inArray, ne } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createGroup, createUser, ok } from "../../../test/fixtures";
import { isError } from "../../errors";
import { userService } from "../../services";
import { getDb } from "../client";
import {
  accountSchema,
  careGroupMemberSchema,
  careGroupSchema,
  careRecipientSchema,
  sessionSchema,
  userSchema,
} from "../schema";
import { ONBOARDING_EMAIL, ONBOARDING_USER_ID, reset, seed } from "./onboardingUser";
import * as setupDismissed from "./setupDismissed";

// The onboarding test account (B-667): seeded with no group and no setup
// state, kept out of the seeded dismissal, and reset to before first login
// without touching any other account's rows.

const PASSWORD = "a-fictional-test-password";
const me = { authUser: { id: ONBOARDING_USER_ID, roleNames: ["member" as const] } };

const state = async () => {
  const db = getDb();
  const [user] = await db.select().from(userSchema).where(eq(userSchema.id, ONBOARDING_USER_ID));
  const groups = await db
    .select({ id: careGroupSchema.id })
    .from(careGroupSchema)
    .where(eq(careGroupSchema.createdBy, ONBOARDING_USER_ID));
  const memberships = await db
    .select({ id: careGroupMemberSchema.id })
    .from(careGroupMemberSchema)
    .where(eq(careGroupMemberSchema.userId, ONBOARDING_USER_ID));
  const sessions = await db
    .select({ id: sessionSchema.id })
    .from(sessionSchema)
    .where(eq(sessionSchema.userId, ONBOARDING_USER_ID));
  const accounts = await db
    .select({ providerId: accountSchema.providerId })
    .from(accountSchema)
    .where(eq(accountSchema.userId, ONBOARDING_USER_ID));
  return { user, groups, memberships, sessions, accounts };
};

/** Every row of the tables the reset could reach that isn't the onboarding account's. */
const othersRows = async () => {
  const db = getDb();
  return {
    users: await db.select().from(userSchema).where(ne(userSchema.id, ONBOARDING_USER_ID)),
    groups: await db.select().from(careGroupSchema).where(ne(careGroupSchema.createdBy, ONBOARDING_USER_ID)),
    members: await db
      .select()
      .from(careGroupMemberSchema)
      .where(ne(careGroupMemberSchema.userId, ONBOARDING_USER_ID)),
    accounts: await db.select().from(accountSchema).where(ne(accountSchema.userId, ONBOARDING_USER_ID)),
    sessions: await db.select().from(sessionSchema).where(ne(sessionSchema.userId, ONBOARDING_USER_ID)),
  };
};

const expectFresh = async () => {
  const now = await state();
  expect(now.user?.email).toBe(ONBOARDING_EMAIL);
  expect(now.user?.preferences.setupDismissed ?? []).toEqual([]);
  expect(now.user?.preferences.groupSetup ?? {}).toEqual({});
  expect(now.groups).toEqual([]);
  expect(now.memberships).toEqual([]);
  expect(now.sessions).toEqual([]);
  expect(now.accounts).toEqual([{ providerId: "credential" }]);
};

describe("onboarding test account", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is seeded with no group and no setup, and resets to that after making a group", async () => {
    vi.stubEnv("SEED_USER_PASSWORD", PASSWORD);
    await seed();
    await seed(); // idempotent
    await expectFresh();

    // Someone else's group, with a member, that the reset must leave alone.
    const other = await createUser("onboarding-other");
    const friend = await createUser("onboarding-friend");
    const { group: otherGroup } = await createGroup(other, [{ user: friend.user, role: "caretaker" }]);

    // The account signs in, makes a group and starts its setup.
    await getDb()
      .insert(sessionSchema)
      .values({
        userId: ONBOARDING_USER_ID,
        token: `onboarding-test-${ONBOARDING_USER_ID}`,
        expiresAt: new Date(Date.now() + 60_000),
      });
    const { group } = await createGroup({ ctx: me });
    ok(await userService.updateOwnPreferences(me, { groupSetup: { [group.id]: { opened: true } } }));

    // The seeded dismissal skips it and the group it made.
    await setupDismissed.seed();
    const [afterDismissal] = await getDb()
      .select({ preferences: userSchema.preferences })
      .from(userSchema)
      .where(eq(userSchema.id, ONBOARDING_USER_ID));
    expect(afterDismissal?.preferences.setupDismissed ?? []).toEqual([]);
    expect(afterDismissal?.preferences.groupSetup).toEqual({ [group.id]: { opened: true } });

    const before = await othersRows();
    const res = await reset();
    expect(isError(res) ? res.code : res).toEqual({ groups: 1 });

    await expectFresh();
    expect(
      await getDb()
        .select({ id: careRecipientSchema.id })
        .from(careRecipientSchema)
        .where(eq(careRecipientSchema.groupId, group.id)),
    ).toEqual([]);
    expect(await othersRows()).toEqual(before);
    expect(
      await getDb()
        .select({ id: careGroupMemberSchema.id })
        .from(careGroupMemberSchema)
        .where(inArray(careGroupMemberSchema.groupId, [otherGroup.id])),
    ).toHaveLength(2);
  });

  it("refuses a database that isn't local or staging", async () => {
    vi.stubEnv("APP_ENV", "production");
    const res = await reset();
    expect(isError(res) && res.code).toBe("db:seed:production");
  });
});
