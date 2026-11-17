import type { GroupRoleName } from "../../constants";

import { inArray } from "drizzle-orm";
import { SYSTEM_USER } from "../../constants";
import { getDb } from "../client";
import { careGroupMemberSchema, careGroupSchema, careRecipientSchema, userSchema } from "../schema";

const seedAudits = { createdBy: SYSTEM_USER.id, updatedBy: SYSTEM_USER.id };

// Fixed ids keep the seed idempotent and easy to reference in dev.
export const DEV_GROUP_ID = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";
export const DEV_RECIPIENT_ID = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0002";

// One member per role. admin@example.com (Caretook staff) is deliberately
// not a member: staff get no access to care data by default.
const MEMBERS: { email: string; role: GroupRoleName }[] = [
  { email: "member@example.com", role: "owner" },
  { email: "caretaker@example.com", role: "caretaker" },
  { email: "viewer@example.com", role: "viewer" },
];

export const seed = async () => {
  const db = getDb();

  await db
    .insert(careGroupSchema)
    .values({ id: DEV_GROUP_ID, name: "Dev Family", ...seedAudits })
    .onConflictDoNothing({ target: careGroupSchema.id });

  await db
    .insert(careRecipientSchema)
    .values({
      id: DEV_RECIPIENT_ID,
      groupId: DEV_GROUP_ID,
      name: "Pat Example",
      preferredName: "Grandma Pat",
      dateOfBirth: "1941-03-14",
      ...seedAudits,
    })
    .onConflictDoNothing({ target: careRecipientSchema.id });

  const users = await db
    .select({ id: userSchema.id, email: userSchema.email })
    .from(userSchema)
    .where(
      inArray(
        userSchema.email,
        MEMBERS.map((m) => m.email),
      ),
    );
  const idByEmail = new Map(users.map((u) => [u.email, u.id]));

  const rows = MEMBERS.flatMap(({ email, role }) => {
    const userId = idByEmail.get(email);
    return userId ? [{ groupId: DEV_GROUP_ID, userId, role, ...seedAudits }] : [];
  });

  if (rows.length) {
    await db
      .insert(careGroupMemberSchema)
      .values(rows)
      .onConflictDoNothing({ target: [careGroupMemberSchema.groupId, careGroupMemberSchema.userId] });
  }
};
