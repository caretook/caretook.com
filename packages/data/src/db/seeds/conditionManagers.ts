import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../client";
import { conditionManagerId, conditionManagerSchema, recipientConditionSchema, userSchema } from "../schema";
import { DEV_GROUP_ID } from "./careGroups";
import { seedRows as conditionRows } from "./conditions";
import { DEV_FAMILY_PROVIDERS, SEED_GROUPS } from "./providers";

// Who diagnosed and who manages Grandma Pat's seeded conditions (conditions
// slice 3), all fictional: each names a seeded condition (by name) and
// seeded providers (by key). Link ids come from the pair (`conditionManagerId`).

export const DEV_FAMILY_CONDITION_PROVIDERS: {
  condition: string;
  diagnosedBy?: string;
  managedBy: string[];
}[] = [
  { condition: "High blood pressure", diagnosedBy: "alvarez", managedBy: ["alvarez", "patel"] },
  { condition: "Type 2 diabetes", diagnosedBy: "alvarez", managedBy: ["alvarez"] },
  { condition: "Pneumonia", diagnosedBy: "mercy", managedBy: [] },
];

const providerIdOf = (key: string) => {
  const group = SEED_GROUPS.find((g) => g.groupId === DEV_GROUP_ID);
  const index = DEV_FAMILY_PROVIDERS.findIndex((p) => p.key === key);
  if (!group || index < 0) throw new Error(`Seed condition names a missing provider: ${key}`);
  return group.providerId(index);
};

const conditionIdOf = (name: string) => {
  const id = conditionRows().find((c) => c.name === name)?.id;
  if (!id) throw new Error(`Seed condition providers name a missing condition: ${name}`);
  return id;
};

/** Who diagnosed each seeded condition, by id. */
export const diagnosedByRows = () =>
  DEV_FAMILY_CONDITION_PROVIDERS.flatMap(({ condition, diagnosedBy }) =>
    diagnosedBy ? [{ conditionId: conditionIdOf(condition), providerId: providerIdOf(diagnosedBy) }] : [],
  );

/** Every seeded manager link as a row (without its author). */
export const seedRows = () =>
  DEV_FAMILY_CONDITION_PROVIDERS.flatMap(({ condition, managedBy }) => {
    const conditionId = conditionIdOf(condition);
    return managedBy.map((key) => {
      const providerId = providerIdOf(key);
      return {
        id: conditionManagerId(conditionId, providerId),
        groupId: DEV_GROUP_ID,
        conditionId,
        providerId,
      };
    });
  });

export const seed = async () => {
  const db = getDb();
  const [author] = await db
    .select({ id: userSchema.id })
    .from(userSchema)
    .where(eq(userSchema.email, "member@example.com"));
  if (!author) return;

  for (const { conditionId, providerId } of diagnosedByRows())
    await db
      .update(recipientConditionSchema)
      .set({ diagnosedById: providerId })
      .where(
        and(eq(recipientConditionSchema.id, conditionId), isNull(recipientConditionSchema.diagnosedById)),
      );

  await db
    .insert(conditionManagerSchema)
    .values(seedRows().map((row) => ({ ...row, createdBy: author.id, updatedBy: author.id })))
    .onConflictDoNothing({ target: conditionManagerSchema.id });
};
