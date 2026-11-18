import type { UserInsert } from "../schema";

import { SYSTEM_USER } from "../../constants";
import { getDb } from "../client";
import { userSchema } from "../schema";

const seedAudits = { createdBy: SYSTEM_USER.id, updatedBy: SYSTEM_USER.id };

// Development accounts only. Never seed real people's data.
export const USERS: UserInsert[] = [
  { email: "admin@example.com", name: "Dev Admin", role: "admin", emailVerified: true },
  { email: "member@example.com", name: "Dev Member", role: "member", emailVerified: true },
  { email: "caretaker@example.com", name: "Dev Caretaker", role: "member", emailVerified: true },
  { email: "viewer@example.com", name: "Dev Viewer", role: "member", emailVerified: true },
];

export const seed = async () => {
  await getDb()
    .insert(userSchema)
    .values(USERS.map((user) => ({ ...user, ...seedAudits })))
    // Idempotent: re-seeding leaves existing rows alone.
    .onConflictDoNothing({ target: userSchema.email });
};
