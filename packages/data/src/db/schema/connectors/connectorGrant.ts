import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "../core/columns";

import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { careGroupSchema } from "../care-groups/careGroup";
import { audits, enumCheck, id, timestamps } from "../core/columns";
import { oauthClientSchema } from "../auth/oauth";
import { userSchema } from "../auth/user";
import { CONNECTOR_SCOPES } from "./connectorRules";

const timestampColumn = (name: string) =>
  timestamp(name, { precision: 3, mode: "string", withTimezone: true });

// A member's AI assistant connected to one care group (connectors PRD): the
// OAuth client (Claude, ChatGPT…) and the user it acts for, bound to the
// group picked on /connect. Every /mcp call goes through it
// (connectorGrantService.verify), so the token alone reaches nothing.
//
// Written only by the system, inside connectorGrantService. Not synced: the
// member and the group's owners and admins read it through the API. No log
// of what the assistant read: only the consent, the connection and when it
// was last used.
export const connectorGrantSchema = pgTable(
  "connector_grant",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => userSchema.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => careGroupSchema.id, { onDelete: "cascade" }),
    oauthClientId: text("oauth_client_id")
      .notNull()
      .references(() => oauthClientSchema.clientId, { onDelete: "cascade" }),
    // The client's registered name (connectorClientName: at most 40
    // characters), shown as text only: any client may call itself "Claude".
    clientName: text("client_name").notNull(),
    // Where the client sends the member back to, shown beside the name.
    redirectHost: text("redirect_host").notNull(),
    scope: text("scope", { enum: CONNECTOR_SCOPES }).notNull(),
    // The consent the member ticked (connectorRules.ts).
    consentVersion: text("consent_version").notNull(),
    consentedAt: timestampColumn("consented_at").notNull(),
    // Stamped by verify, at most once a minute.
    lastUsedAt: timestampColumn("last_used_at"),
    // Revoked ⇔ set: by the member, an owner or admin, the switch, or leaving.
    revokedAt: timestampColumn("revoked_at"),
    ...timestamps,
    ...audits,
  },
  (t) => [
    // One live connection per member and client: connecting again replaces it.
    uniqueIndex("connector_grant_live_unique")
      .on(t.userId, t.oauthClientId)
      .where(sql`${t.revokedAt} IS NULL`),
    index("connector_grant_group_idx").on(t.groupId),
    enumCheck("connector_grant_scope_check", t.scope, CONNECTOR_SCOPES),
  ],
);

export type ConnectorGrantSchema = typeof connectorGrantSchema;
export type ConnectorGrantSelect = InferSelectModel<ConnectorGrantSchema>;
export type ConnectorGrantInsert = Omit<InferInsertModel<ConnectorGrantSchema>, ProtectedField>;
export type ConnectorGrant = ConnectorGrantSelect;
