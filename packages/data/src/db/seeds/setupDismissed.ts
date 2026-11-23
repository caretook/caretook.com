import { eq, inArray, like, or } from "drizzle-orm";
import { SYSTEM_USER } from "../../constants";
import { getDb } from "../client";
import { careGroupMemberSchema, careGroupSchema, mergeSetupDismissed, userSchema } from "../schema";
import { SEEDED_DOMAIN } from "./accounts";

type Membership = { userId: string; groupId: string; dismissed: readonly string[] | undefined };

/** Each member whose list lacks one of their seeded groups, with the list to store. */
export const dismissalsToAdd = (memberships: readonly Membership[]) => {
  const byUser = new Map<string, { base: readonly string[]; groups: string[] }>();
  for (const { userId, groupId, dismissed } of memberships) {
    const entry = byUser.get(userId) ?? { base: dismissed ?? [], groups: [] };
    entry.groups.push(groupId);
    byUser.set(userId, entry);
  }
  return [...byUser].flatMap(([userId, { base, groups }]) => {
    const setupDismissed = mergeSetupDismissed(base, groups);
    return setupDismissed.length === base.length ? [] : [{ userId, setupDismissed }];
  });
};

/**
 * Every member of a seeded group (one the system or a seeded account created)
 * starts with its setup card dismissed, so the card doesn't appear across
 * every check. A group a real account made is left alone. Idempotent.
 */
export const seed = async () => {
  const db = getDb();
  const seededUsers = db
    .select({ id: userSchema.id })
    .from(userSchema)
    .where(like(userSchema.email, `%${SEEDED_DOMAIN}`));
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
    .where(inArray(careGroupMemberSchema.groupId, groups));
  const prefsOf = new Map(rows.map((r) => [r.userId, r.preferences]));
  const changes = dismissalsToAdd(
    rows.map((r) => ({ userId: r.userId, groupId: r.groupId, dismissed: r.preferences.setupDismissed })),
  );
  for (const { userId, setupDismissed } of changes)
    await db
      .update(userSchema)
      .set({ preferences: { ...prefsOf.get(userId), setupDismissed } })
      .where(eq(userSchema.id, userId));
};
