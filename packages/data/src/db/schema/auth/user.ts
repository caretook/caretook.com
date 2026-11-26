import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "../core/columns";
import type { UserPreferences } from "../app-shell/userPreferences";

import { sql } from "drizzle-orm";
import { boolean, check, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";
import { USER_ROLE_NAMES } from "../../../constants/roles";
import { AVATAR_COLORS, AVATAR_ICONS } from "../app-shell/avatar";
import { audits, id, timestamps } from "../core/columns";

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
    // Display settings (units…), validated by userPreferencesZSchema. Read
    // through its resolvers, which fill in defaults.
    preferences: jsonb("preferences").$type<UserPreferences>().notNull().default({}),
    // A disabled account (admin PRD): no sessions, no sign-in, no tokens; its
    // memberships and data stay. Set and cleared only by staff, through the
    // services (as the system). `disabled_by` has no FK, as with audits.
    disabledAt: timestamp("disabled_at", { precision: 3, mode: "string", withTimezone: true }),
    disabledBy: uuid("disabled_by"),
    disabledReason: text("disabled_reason"),
    // The member's avatar: ids from the fixed catalog (app-shell/avatar.ts),
    // null for the default. Co-members see them (PUBLIC_PROFILE_FIELDS).
    avatarColor: text("avatar_color", { enum: AVATAR_COLORS }),
    avatarIcon: text("avatar_icon", { enum: AVATAR_ICONS }),
    ...timestamps,
    ...audits,
  },
  (t) => [
    // `text({ enum })` only narrows the TS type; this enforces it in the database.
    check("user_role_check", sql`${t.role} IN (${sql.raw(USER_ROLE_NAMES.map((r) => `'${r}'`).join(", "))})`),
    check(
      "user_avatar_color_check",
      sql`${t.avatarColor} IN (${sql.raw(AVATAR_COLORS.map((c) => `'${c}'`).join(", "))})`,
    ),
    check(
      "user_avatar_icon_check",
      sql`${t.avatarIcon} IN (${sql.raw(AVATAR_ICONS.map((i) => `'${i}'`).join(", "))})`,
    ),
  ],
);

export type UserSchema = typeof userSchema;
export type UserSelect = InferSelectModel<UserSchema>;
export type UserInsert = Omit<InferInsertModel<UserSchema>, ProtectedField>;
export type UserUpdate = Partial<UserInsert>;
export type User = UserSelect;

// drizzle-zod's schemas are marked pure and take no calls as arguments, so a
// bundle that doesn't use one (the web app) drops it, and with it drizzle-zod,
// which would keep all of zod (its locales, JSON Schema) in the app (B-872).
const email = z.email();
export const userSelectZSchema = /* @__PURE__ */ createSelectSchema(userSchema);
export const userInsertZSchema = /* @__PURE__ */ createInsertSchema(userSchema, { email });
export const userUpdateZSchema = /* @__PURE__ */ createUpdateSchema(userSchema, { email });
