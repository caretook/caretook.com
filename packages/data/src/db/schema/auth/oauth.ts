import type { InferSelectModel } from "drizzle-orm";

import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { id } from "../core/columns";
import { sessionSchema } from "./auth";
import { userSchema } from "./user";

// The tables of Better Auth's OAuth 2.1 provider plugin
// (`@better-auth/oauth-provider`, connectors PRD): the clients an assistant
// registers, their tokens and the consents. Like auth.ts, these are Better
// Auth's own: no audits, date-mode timestamps, and `system`-only permissions.
// Column keys (JS names) must match the plugin's field names; drizzle's pg
// adapter stores its `string[]` fields as text arrays and `json` as jsonb.
//
// Which group a token reaches is ours, not the plugin's: connector_grant
// (db/schema/connectors/) binds a user and a client to one group.

const dateColumn = (name: string) => timestamp(name, { precision: 3, mode: "date", withTimezone: true });

/** A registered client (Claude, ChatGPT, …): public clients from dynamic registration. */
export const oauthClientSchema = pgTable(
  "oauth_client",
  {
    id: id(),
    clientId: text("client_id").notNull().unique(),
    clientSecret: text("client_secret"),
    clientDiscoveryId: text("client_discovery_id"),
    disabled: boolean("disabled").default(false),
    skipConsent: boolean("skip_consent"),
    enableEndSession: boolean("enable_end_session"),
    subjectType: text("subject_type"),
    scopes: text("scopes").array(),
    clientCredentialsScopes: text("client_credentials_scopes").array().default([]),
    userId: uuid("user_id").references(() => userSchema.id, { onDelete: "cascade" }),
    createdAt: dateColumn("created_at"),
    updatedAt: dateColumn("updated_at"),
    name: text("name"),
    uri: text("uri"),
    icon: text("icon"),
    contacts: text("contacts").array(),
    tos: text("tos"),
    policy: text("policy"),
    softwareId: text("software_id"),
    softwareVersion: text("software_version"),
    softwareStatement: text("software_statement"),
    redirectUris: text("redirect_uris").array().notNull(),
    postLogoutRedirectUris: text("post_logout_redirect_uris").array(),
    backchannelLogoutUri: text("backchannel_logout_uri"),
    backchannelLogoutSessionRequired: boolean("backchannel_logout_session_required"),
    tokenEndpointAuthMethod: text("token_endpoint_auth_method"),
    applicationType: text("application_type"),
    jwks: text("jwks"),
    jwksUri: text("jwks_uri"),
    grantTypes: text("grant_types").array(),
    responseTypes: text("response_types").array(),
    requirePKCE: boolean("require_pkce"),
    dpopBoundAccessTokens: boolean("dpop_bound_access_tokens").default(false),
    referenceId: text("reference_id"),
    metadata: jsonb("metadata"),
  },
  (t) => [index("oauth_client_user_id_idx").on(t.userId)],
);

/** A protected resource tokens are issued for: `${APP_URL}/mcp`, seeded by the plugin at start. */
export const oauthResourceSchema = pgTable("oauth_resource", {
  id: id(),
  identifier: text("identifier").notNull().unique(),
  name: text("name").notNull(),
  accessTokenTtl: integer("access_token_ttl"),
  refreshTokenTtl: integer("refresh_token_ttl"),
  signingAlgorithm: text("signing_algorithm"),
  signingKeyId: text("signing_key_id"),
  allowedScopes: text("allowed_scopes").array(),
  customClaims: jsonb("custom_claims"),
  dpopBoundAccessTokensRequired: boolean("dpop_bound_access_tokens_required").default(false),
  disabled: boolean("disabled").default(false),
  createdAt: dateColumn("created_at"),
  updatedAt: dateColumn("updated_at"),
  policyVersion: integer("policy_version").default(1),
  metadata: jsonb("metadata"),
});

/** Which clients may ask for which resources (every new client gets /mcp). */
export const oauthClientResourceSchema = pgTable(
  "oauth_client_resource",
  {
    id: id(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClientSchema.clientId, { onDelete: "cascade" }),
    resourceId: text("resource_id")
      .notNull()
      .references(() => oauthResourceSchema.identifier, { onDelete: "cascade" }),
    metadata: jsonb("metadata"),
    createdAt: dateColumn("created_at"),
  },
  (t) => [
    index("oauth_client_resource_client_id_idx").on(t.clientId),
    index("oauth_client_resource_resource_id_idx").on(t.resourceId),
    uniqueIndex("oauth_client_resource_unique").on(t.clientId, t.resourceId),
  ],
);

/** Rotating refresh tokens (30 days), stored hashed. */
export const oauthRefreshTokenSchema = pgTable(
  "oauth_refresh_token",
  {
    id: id(),
    token: text("token").notNull().unique(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClientSchema.clientId, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => sessionSchema.id, { onDelete: "set null" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => userSchema.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"),
    authorizationCodeId: text("authorization_code_id"),
    resources: text("resources").array(),
    requestedUserInfoClaims: text("requested_user_info_claims").array(),
    expiresAt: dateColumn("expires_at").notNull(),
    createdAt: dateColumn("created_at").notNull(),
    revoked: dateColumn("revoked"),
    rotatedAt: dateColumn("rotated_at"),
    rotationReplayResponse: text("rotation_replay_response"),
    rotationReplayExpiresAt: dateColumn("rotation_replay_expires_at"),
    authTime: dateColumn("auth_time"),
    confirmation: jsonb("confirmation"),
    scopes: text("scopes").array().notNull(),
  },
  (t) => [
    index("oauth_refresh_token_client_id_idx").on(t.clientId),
    index("oauth_refresh_token_session_id_idx").on(t.sessionId),
    index("oauth_refresh_token_user_id_idx").on(t.userId),
    index("oauth_refresh_token_authorization_code_id_idx").on(t.authorizationCodeId),
  ],
);

/** Opaque access tokens (1 hour), stored hashed. */
export const oauthAccessTokenSchema = pgTable(
  "oauth_access_token",
  {
    id: id(),
    token: text("token").notNull().unique(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClientSchema.clientId, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => sessionSchema.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => userSchema.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"),
    authorizationCodeId: text("authorization_code_id"),
    resources: text("resources").array(),
    requestedUserInfoClaims: text("requested_user_info_claims").array(),
    refreshId: uuid("refresh_id").references(() => oauthRefreshTokenSchema.id, { onDelete: "cascade" }),
    expiresAt: dateColumn("expires_at").notNull(),
    createdAt: dateColumn("created_at").notNull(),
    revoked: dateColumn("revoked"),
    confirmation: jsonb("confirmation"),
    scopes: text("scopes").array().notNull(),
  },
  (t) => [
    index("oauth_access_token_client_id_idx").on(t.clientId),
    index("oauth_access_token_session_id_idx").on(t.sessionId),
    index("oauth_access_token_user_id_idx").on(t.userId),
    index("oauth_access_token_authorization_code_id_idx").on(t.authorizationCodeId),
    index("oauth_access_token_refresh_id_idx").on(t.refreshId),
  ],
);

/** What a user agreed to for a client. Revoking a connection deletes it, so the next authorize asks again. */
export const oauthConsentSchema = pgTable(
  "oauth_consent",
  {
    id: id(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClientSchema.clientId, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => userSchema.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"),
    resources: text("resources").array(),
    requestedUserInfoClaims: text("requested_user_info_claims").array(),
    scopes: text("scopes").array().notNull(),
    createdAt: dateColumn("created_at").notNull(),
    updatedAt: dateColumn("updated_at").notNull(),
  },
  (t) => [
    index("oauth_consent_client_id_idx").on(t.clientId),
    index("oauth_consent_user_id_idx").on(t.userId),
  ],
);

// Single-use `private_key_jwt` assertion ids (unused: our clients are public,
// but the plugin expects the model). The id is the plugin's digest, not a uuid.
export const oauthClientAssertionSchema = pgTable("oauth_client_assertion", {
  id: text("id").primaryKey(),
  expiresAt: dateColumn("expires_at").notNull(),
});

export type OAuthClient = InferSelectModel<typeof oauthClientSchema>;
export type OAuthAccessToken = InferSelectModel<typeof oauthAccessTokenSchema>;
