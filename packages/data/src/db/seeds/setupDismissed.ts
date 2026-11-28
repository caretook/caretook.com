import type { GroupSetup } from "../schema";

import { and, eq, inArray, like, ne, or } from "drizzle-orm";
import { SYSTEM_USER } from "../../constants";
import { getDb } from "../client";
import {
  careGroupMemberSchema,
  careGroupSchema,
  mergeGroupSetup,
  mergeSetupDismissed,
  SETUP_NUDGES,
  userSchema,
} from "../schema";
import { SEEDED_DOMAIN } from "./accounts";
import { ONBOARDING_USER_ID } from "./onboardingUser";

type Membership = {
  userId: string;
  groupId: string;
  dismissed: readonly string[] | undefined;
  groupSetup?: Readonly<GroupSetup> | undefined;
};

/** A seeded group's setup, done: opened, every nudge retired. */
const DONE = { opened: true, retired: [...SETUP_NUDGES] } as const;

/** Each member whose setup card or setup record lacks one of their seeded groups, with both to store. */
export const dismissalsToAdd = (memberships: readonly Membership[]) => {
  const byUser = new Map<
    string,
    { base: readonly string[]; baseSetup: Readonly<GroupSetup>; groups: string[] }
  >();
  for (const { userId, groupId, dismissed, groupSetup } of memberships) {
    const entry = byUser.get(userId) ?? { base: dismissed ?? [], baseSetup: groupSetup ?? {}, groups: [] };
    entry.groups.push(groupId);
    byUser.set(userId, entry);
  }
  return [...byUser].flatMap(([userId, { base, baseSetup, groups }]) => {
    const setupDismissed = mergeSetupDismissed(base, groups);
    const groupSetup = mergeGroupSetup(
      baseSetup,
      Object.fromEntries(groups.map((id) => [id, { ...DONE, retired: [...DONE.retired] }])),
    );
    const unchanged =
      setupDismissed.length === base.length && JSON.stringify(groupSetup) === JSON.stringify(baseSetup);
    return unchanged ? [] : [{ userId, setupDismissed, groupSetup }];
  });
};

/**
 * Every member of a seeded group (one the system or a seeded account created)
 * starts with its setup card dismissed and its setup done (opened, every
 * nudge retired), so neither the card, the setup redirect nor a nudge
 * appears across every check. A group a real account made is left alone, and
 * so are the onboarding test account (`onboardingUser.ts`) and any group it
 * made, so it always gets the setup flow. Idempotent.
 */
export const seed = async () => {
  const db = getDb();
  const seededUsers = db
    .select({ id: userSchema.id })
    .from(userSchema)
    .where(and(like(userSchema.email, `%${SEEDED_DOMAIN}`), ne(userSchema.id, ONBOARDING_USER_ID)));
  const groups = db
    .select({ id: careGroupSchema.id })
    .from(careGroupSchema)
    .where(
      or(eq(careGroupSchema.createdBy, SYSTEM_USER.id), inArray(careGroupSchema.createdBy, seededUsers)),
    );
  const rows = await db
    .select({
      userId: careGroupMemberSchema.userId,
      groupId: careGroupMemberSchema.groupId,
      preferences: userSchema.preferences,
    })
    .from(careGroupMemberSchema)
    .innerJoin(userSchema, eq(userSchema.id, careGroupMemberSchema.userId))
    .where(
      and(
        inArray(careGroupMemberSchema.groupId, groups),
        ne(careGroupMemberSchema.userId, ONBOARDING_USER_ID),
      ),
    );
  const prefsOf = new Map(rows.map((r) => [r.userId, r.preferences]));
  const changes = dismissalsToAdd(
    rows.map((r) => ({
      userId: r.userId,
      groupId: r.groupId,
      dismissed: r.preferences.setupDismissed,
      groupSetup: r.preferences.groupSetup,
    })),
  );
  for (const { userId, setupDismissed, groupSetup } of changes)
    await db
      .update(userSchema)
      .set({ preferences: { ...prefsOf.get(userId), setupDismissed, groupSetup } })
      .where(eq(userSchema.id, userId));
};
