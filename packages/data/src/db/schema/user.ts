import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "./columns";

import { sql } from "drizzle-orm";
import { boolean, check, pgTable, text } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";
import { USER_ROLE_NAMES } from "../../constants/roles";
import { audits, id, timestamps } from "./columns";

// Column names line up with Better Auth's user table (name, email,
// email_verified, image) so it can adopt this table later.
export const userSchema = pgTable(
  "user",
  {
    id: id(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    name: text("name"),
    image: text("image"),
    role: text("role", { enum: USER_ROLE_NAMES }).notNull().default("member"),
    ...timestamps,
    ...audits,
  },
  (t) => [
    // `text({ enum })` only narrows the TS type; this enforces it in the database.
    check("user_role_check", sql`${t.role} IN (${sql.raw(USER_ROLE_NAMES.map((r) => `'${r}'`).join(", "))})`),
  ],
);

export type UserSchema = typeof userSchema;
export type UserSelect = InferSelectModel<UserSchema>;
export type UserInsert = Omit<InferInsertModel<UserSchema>, ProtectedField>;
export type UserUpdate = Partial<UserInsert>;
export type User = UserSelect;

export const userSelectZSchema = createSelectSchema(userSchema);
export const userInsertZSchema = createInsertSchema(userSchema, { email: z.email() });
export const userUpdateZSchema = createUpdateSchema(userSchema, { email: z.email() });
