// The rules for connecting a member's own AI assistant (Claude, ChatGPT…)
// to one care group (connectors PRD), shared by the server
// (connectorGrantService, /mcp) and the consent page (/connect). Pure and
// client-safe; the server stays the authority.

import type { GroupRoleName } from "../../../constants/roles";

import { isEasyRole, isWriterRole } from "../../../constants/roles";

/** What a connection may do: read the group, or read it and add to it. */
export const CONNECTOR_SCOPES = ["read", "readWrite"] as const;
export type ConnectorScope = (typeof CONNECTOR_SCOPES)[number];

export const isConnectorScope = (value: unknown): value is ConnectorScope =>
  CONNECTOR_SCOPES.some((scope) => scope === value);

/** The OAuth scopes the authorization server knows (`offline_access` brings a refresh token). */
export const CONNECTOR_OAUTH_SCOPES = {
  read: "group:read",
  write: "group:write",
  offline: "offline_access",
} as const;
export const OAUTH_SCOPES = [
  CONNECTOR_OAUTH_SCOPES.read,
  CONNECTOR_OAUTH_SCOPES.write,
  CONNECTOR_OAUTH_SCOPES.offline,
] as const;

/**
 * What the member agrees to on /connect, recorded (by version) on the
 * grant. Change the text and the version together: a recorded version must
 * always mean the words that person saw.
 */
export const CONNECTOR_CONSENT_VERSION = "2026-11-21";
export const CONNECTOR_CONSENT_TEXT =
  "I understand that connecting sends this care group's information that I can see (its timeline, notes, vitals, medications, appointments, todos, providers and the care recipient's medical profile, including allergies and conditions, but no one's contact details) to the AI assistant I chose, under that company's terms. I can disconnect it at any time.";

/** The longest client name we keep or show (names come from the client's own registration). */
export const CONNECTOR_CLIENT_NAME_MAX = 40;

/** A registered client's name as we store and show it: trimmed, at most 40 characters, never empty. */
export const connectorClientName = (name: string | null | undefined) =>
  (name ?? "").replace(/\s+/g, " ").trim().slice(0, CONNECTOR_CLIENT_NAME_MAX).trim() || "AI assistant";

/**
 * The scopes a member with `role` may grant, widest last: viewers read only,
 * and the easy roles none (setup stays with technical members, so a role
 * change to an easy role cuts a connected assistant off). A group its owner
 * set to read only narrows everyone to read.
 */
export const scopesForRole = (
  role: GroupRoleName | null | undefined,
  groupReadOnly = false,
): readonly ConnectorScope[] => {
  if (!role || isEasyRole(role)) return [];
  return isWriterRole(role) && !groupReadOnly ? CONNECTOR_SCOPES : ["read"];
};

/**
 * What a grant may do now: what was granted, narrowed by the member's
 * current role (a caretaker demoted to viewer reads only, whatever they
 * granted) and the group's read-only setting. Null when they're no longer a
 * member, or have an easy role. The stored grant never changes.
 */
export const effectiveScope = (
  granted: ConnectorScope,
  role: GroupRoleName | null | undefined,
  groupReadOnly = false,
): ConnectorScope | null => {
  const allowed = scopesForRole(role, groupReadOnly);
  if (!allowed.length) return null;
  return allowed.includes(granted) ? granted : "read";
};

/**
 * Whether the group's read-only setting is what stops this connection
 * writing: true only when it could write with the setting off. A read grant,
 * a demoted viewer or a token without the write scope is never the owner's
 * doing. `tokenCanWrite` is for /mcp, which knows the token's scopes.
 */
export const readOnlyByOwner = (
  granted: ConnectorScope,
  role: GroupRoleName | null | undefined,
  groupReadOnly: boolean,
  tokenCanWrite = true,
) => groupReadOnly && tokenCanWrite && effectiveScope(granted, role) === "readWrite";

/** The OAuth scopes a grant of `scope` puts on its tokens. */
export const oauthScopesFor = (scope: ConnectorScope): string[] =>
  scope === "readWrite"
    ? [CONNECTOR_OAUTH_SCOPES.read, CONNECTOR_OAUTH_SCOPES.write, CONNECTOR_OAUTH_SCOPES.offline]
    : [CONNECTOR_OAUTH_SCOPES.read, CONNECTOR_OAUTH_SCOPES.offline];

/** A grant's scope as plain words (the consent page, Settings → Devices). */
export const CONNECTOR_SCOPE_LABELS: Record<ConnectorScope, string> = {
  read: "Read only",
  readWrite: "Read and add entries",
};

/** Why a connection can only read when the group's owner chose it (every screen, and /mcp's refusal). */
export const CONNECTOR_READ_ONLY_BY_OWNER_LABEL = "Read only, set by the group owner";
