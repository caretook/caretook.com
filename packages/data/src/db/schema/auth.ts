import type { InferSelectModel } from "drizzle-orm";

import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id } from "./columns";
import { userSchema } from "./user";

// Tables owned by Better Auth (packages/auth). It reads and writes them
// through its drizzle adapter, never through our models, so they skip the
// usual `audits` columns and only the system may touch them in PERMISSIONS.
//
// Column keys (JS names) must match Better Auth's field names; the users
// table is shared with the rest of the app (see user.ts).
//
// Timestamps here use `mode: "date"`: Better Auth compares them with Date
// objects (e.g. session expiry), and string mode would silently break that.

const dateColumn = (name: string) => timestamp(name, { precision: 3, mode: "date", withTimezone: true });

const authTimestamps = {
  createdAt: dateColumn("created_at").defaultNow().notNull(),
  updatedAt: dateColumn("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

export const sessionSchema = pgTable(
  "session",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => userSchema.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: dateColumn("expires_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    ...authTimestamps,
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

// One row per way a user can sign in. `providerId` "credential" holds the
// password hash; social or magic-link providers would add rows later.
export const accountSchema = pgTable(
  "account",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => userSchema.id, { onDelete: "cascade" }),
    providerId: text("provider_id").notNull(),
    accountId: text("account_id").notNull(),
    password: text("password"),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: dateColumn("access_token_expires_at"),
    refreshTokenExpiresAt: dateColumn("refresh_token_expires_at"),
    scope: text("scope"),
    ...authTimestamps,
  },
  (t) => [
    index("account_user_id_idx").on(t.userId),
    uniqueIndex("account_provider_account_unique").on(t.providerId, t.accountId),
  ],
);

// Short-lived values: email verification and password reset tokens.
export const verificationSchema = pgTable(
  "verification",
  {
    id: id(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: dateColumn("expires_at").notNull(),
    ...authTimestamps,
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// Signing keys for the JWT plugin (PowerSync and workers verify against the
// JWKS endpoint). Better Auth encrypts `private_key` with BETTER_AUTH_SECRET.
export const jwksSchema = pgTable("jwks", {
  id: id(),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  alg: text("alg"),
  crv: text("crv"),
  createdAt: dateColumn("created_at").defaultNow().notNull(),
  expiresAt: dateColumn("expires_at"),
});

export type Session = InferSelectModel<typeof sessionSchema>;
export type Account = InferSelectModel<typeof accountSchema>;
