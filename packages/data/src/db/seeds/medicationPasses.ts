import { eq } from "drizzle-orm";
import { getDb } from "../client";
import { DEFAULT_PASSES, medicationPassSchema, userSchema } from "../schema";
import { DEV_GROUP_ID, DEV_RECIPIENT_ID } from "./careGroups";
import { SECOND_GROUP_ID, SECOND_RECIPIENT_ID } from "./secondGroup";

// Both seeded groups' medication passes: the defaults every new group gets
// (Morning 08:00, Evening 20:00). Their own ids, following list order
// (append only): …3f1d2b9d… Dev Family's, …3f1d2b9e… Dev Family 2's.

const devFamilyPassId = (index: number) =>
  `0b6f3c1e-5d1a-4c2e-9a77-3f1d2b9d${String(1001 + index).padStart(4, "0")}`;
const secondGroupPassId = (index: number) =>
  `0b6f3c1e-5d1a-4c2e-9a77-3f1d2b9e${String(1001 + index).padStart(4, "0")}`;

/** Dev Family's Morning and Evening passes' ids. */
export const DEV_FAMILY_PASS_IDS = { morning: devFamilyPassId(0), evening: devFamilyPassId(1) } as const;

export const SEED_PASS_GROUPS = [
  { groupId: DEV_GROUP_ID, recipientId: DEV_RECIPIENT_ID, passId: devFamilyPassId },
  { groupId: SECOND_GROUP_ID, recipientId: SECOND_RECIPIENT_ID, passId: secondGroupPassId },
];

/** Every seeded pass as a row (audits still to fill). */
export const seedPassRows = () =>
  SEED_PASS_GROUPS.flatMap(({ groupId, recipientId, passId }) =>
    DEFAULT_PASSES.map((pass, sortOrder) => ({
      id: passId(sortOrder),
      groupId,
      recipientId,
      name: pass.name,
      time: pass.time,
      sortOrder,
    })),
  );

export const seed = async () => {
  const db = getDb();
  const [owner] = await db
    .select({ id: userSchema.id })
    .from(userSchema)
    .where(eq(userSchema.email, "member@example.com"));
  if (!owner) return;
  await db
    .insert(medicationPassSchema)
    .values(seedPassRows().map((row) => ({ ...row, createdBy: owner.id, updatedBy: owner.id })))
    .onConflictDoNothing({ target: medicationPassSchema.id });
};
