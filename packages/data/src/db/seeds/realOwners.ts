import { inArray, like, notLike, or, eq } from "drizzle-orm";
import { SYSTEM_USER } from "../../constants";
import { getDb } from "../client";
import { careGroupMemberSchema, careGroupSchema, userSchema } from "../schema";
import { SEEDED_DOMAIN } from "./accounts";

const seedAudits = { createdBy: SYSTEM_USER.id, updatedBy: SYSTEM_USER.id };

/**
 * Staging only (`APP_ENV=staging`): every real account (any address that
 * isn't `@example.com`) becomes an owner of every seeded group, so the people
 * testing staging see the fictional data without an invite. A seeded group is
 * one the system or a seeded account created; a group a real account made is
 * left alone, and so is a membership that already exists, whatever its role.
 * Idempotent. Elsewhere (dev, tests) it does nothing.
 */
export const seed = async ({ env = process.env }: { env?: { APP_ENV?: string } } = {}) => {
  if (env.APP_ENV?.trim() !== "staging") return { added: 0 };

  const db = getDb();
  const seeded = `%${SEEDED_DOMAIN}`;
  const realUsers = await db
    .select({ id: userSchema.id })
    .from(userSchema)
    .where(notLike(userSchema.email, seeded));
  if (!realUsers.length) return { added: 0 };

  const seededUsers = db.select({ id: userSchema.id }).from(userSchema).where(like(userSchema.email, seeded));
  const groups = await db
    .select({ id: careGroupSchema.id })
    .from(careGroupSchema)
    .where(
      or(eq(careGroupSchema.createdBy, SYSTEM_USER.id), inArray(careGroupSchema.createdBy, seededUsers)),
    );
  if (!groups.length) return { added: 0 };

  const added = await db
    .insert(careGroupMemberSchema)
    .values(
      groups.flatMap((group) =>
        realUsers.map((user) => ({
          groupId: group.id,
          userId: user.id,
          role: "owner" as const,
          ...seedAudits,
        })),
      ),
    )
    .onConflictDoNothing({ target: [careGroupMemberSchema.groupId, careGroupMemberSchema.userId] })
    .returning({ id: careGroupMemberSchema.id });
  return { added: added.length };
};
