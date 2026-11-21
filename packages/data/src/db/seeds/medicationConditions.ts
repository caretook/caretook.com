import { eq } from "drizzle-orm";
import { getDb } from "../client";
import { medicationConditionId, medicationConditionSchema, userSchema } from "../schema";
import { DEV_GROUP_ID } from "./careGroups";
import { seedRows as conditionRows } from "./conditions";
import { DEV_FAMILY_MEDICATIONS, SEED_GROUPS } from "./medications";

// What Grandma Pat's seeded medications are for (conditions slice 4), all
// fictional: each pair names a seeded medication (by key) and a seeded
// condition (by name). Ids come from the pair (`medicationConditionId`).

export const DEV_FAMILY_MEDICATION_CONDITIONS: { medication: string; condition: string }[] = [
  { medication: "lisinopril", condition: "High blood pressure" },
  { medication: "metformin", condition: "Type 2 diabetes" },
  { medication: "latanoprost", condition: "Glaucoma" },
];

/** Every seeded link as a row (without its author). */
export const seedRows = () => {
  const group = SEED_GROUPS.find((g) => g.groupId === DEV_GROUP_ID);
  if (!group) throw new Error("No Dev Family medications to link");
  const conditions = conditionRows();
  return DEV_FAMILY_MEDICATION_CONDITIONS.map(({ medication, condition }) => {
    const index = DEV_FAMILY_MEDICATIONS.findIndex((m) => m.key === medication);
    const conditionId = conditions.find((c) => c.name === condition)?.id;
    if (index < 0 || !conditionId)
      throw new Error(`Seed link names a missing row: ${medication}, ${condition}`);
    const medicationId = group.medicationId(index);
    return {
      id: medicationConditionId(medicationId, conditionId),
      groupId: DEV_GROUP_ID,
      medicationId,
      conditionId,
    };
  });
};

export const seed = async () => {
  const db = getDb();
  const [author] = await db
    .select({ id: userSchema.id })
    .from(userSchema)
    .where(eq(userSchema.email, "member@example.com"));
  if (!author) return;

  await db
    .insert(medicationConditionSchema)
    .values(seedRows().map((row) => ({ ...row, createdBy: author.id, updatedBy: author.id })))
    .onConflictDoNothing({ target: medicationConditionSchema.id });
};
