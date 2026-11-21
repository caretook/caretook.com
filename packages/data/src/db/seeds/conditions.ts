import { eq } from "drizzle-orm";
import { getDb } from "../client";
import { recipientConditionSchema, userSchema } from "../schema";
import { DEV_GROUP_ID, DEV_RECIPIENT_ID } from "./careGroups";

// Grandma Pat's conditions (conditions PRD), all fictional: three active
// ones behind her seeded medications (Lisinopril, Metformin, Latanoprost)
// and one resolved. Links to providers and medications come later
// (conditions slices 3 and 4).
//
// Their own ids (…3f1d2bf0…), following list order: append only.

export type SeedCondition = {
  name: string;
  status: "active" | "resolved";
  sinceYear?: number;
  sinceMonth?: number;
  note?: string;
};

export const DEV_FAMILY_CONDITIONS: SeedCondition[] = [
  { name: "High blood pressure", status: "active", sinceYear: 2012 },
  { name: "Type 2 diabetes", status: "active", sinceYear: 2016, sinceMonth: 3, note: "Metformin and diet" },
  { name: "Glaucoma", status: "active", sinceYear: 2019, note: "Eye drops every evening" },
  { name: "Pneumonia", status: "resolved", sinceYear: 2025, sinceMonth: 11 },
];

const conditionId = (index: number) =>
  `0b6f3c1e-5d1a-4c2e-9a77-3f1d2bf0${String(1001 + index).padStart(4, "0")}`;

/** Every seeded condition as a row (without its author). */
export const seedRows = () =>
  DEV_FAMILY_CONDITIONS.map((condition, index) => ({
    id: conditionId(index),
    groupId: DEV_GROUP_ID,
    recipientId: DEV_RECIPIENT_ID,
    name: condition.name,
    status: condition.status,
    sinceYear: condition.sinceYear ?? null,
    sinceMonth: condition.sinceMonth ?? null,
    note: condition.note ?? null,
  }));

export const seed = async () => {
  const db = getDb();
  const [author] = await db
    .select({ id: userSchema.id })
    .from(userSchema)
    .where(eq(userSchema.email, "member@example.com"));
  if (!author) return;

  await db
    .insert(recipientConditionSchema)
    .values(seedRows().map((row) => ({ ...row, createdBy: author.id, updatedBy: author.id })))
    .onConflictDoNothing({ target: recipientConditionSchema.id });
};
