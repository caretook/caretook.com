import type { AppError, AuthUser, ConnectorScope, GroupRoleName } from "@caretook/data";
import type { Auth } from "@caretook/auth";

import { getAuth, isSignedConnectQuery } from "@caretook/auth";
import {
  assistantRequestService,
  careGroupService,
  careRecipientService,
  CONNECTOR_OAUTH_SCOPES,
  connectorGrantService,
  isConnectorScope,
  isError,
  scopesForRole,
} from "@caretook/data";

// /connect's server side (connectors PRD), framework-free so the OAuth
// integration test drives the same code the page does. Better Auth's OAuth
// plugin sends the member to /connect with a signed authorize request; the
// page shows the client, the groups whose owners turned Assistants on and
// the scopes the member's role allows; Connect records the grant and tells
// the plugin, which answers with the client's redirect (and a code).

/** What the signed query names: the client, where it goes back to, and the scopes it asked for. */
export type ConnectRequest = { clientId: string; redirectUri: string; scopes: string[]; search: string };

/** A group the member may connect (the switch is on), with the scopes they may pick, narrowest first. */
export type ConnectGroup = {
  id: string;
  name: string;
  recipientName: string | null;
  role: GroupRoleName;
  scopes: readonly ConnectorScope[];
};

/**
 * A group of the member's whose switch is off (connectors-2), for the "no
 * group allows assistants" state: a member who isn't an owner asks its
 * owners from there. `askedAt` is their last request (null: never, or an owner).
 */
export type OffGroup = {
  id: string;
  name: string;
  recipientName: string | null;
  role: GroupRoleName;
  askedAt: string | null;
};

export type ConnectPage =
  | { state: "invalid" }
  | {
      state: "consent";
      client: { name: string; redirectHost: string };
      groups: ConnectGroup[];
      /** Filled only when `groups` is empty. */
      offGroups: OffGroup[];
    };

/** Who was connected where, for the success step (connectors-2 PRD). */
export type ConnectedTo = { groupName: string; clientName: string };

/**
 * Connect's outcome: where to send the member (the client, with a code or
 * access denied), or what to fix. A connection also says what was connected,
 * so the page shows the success step before it returns.
 */
export type ConnectOutcome = { redirect: string; connected?: ConnectedTo } | { error: string };

const hostOf = (uri: string) => {
  try {
    return new URL(uri).host || null;
  } catch {
    return null;
  }
};

/** The authorize request in `search` (without "?"), if the plugin signed it and it's fresh (10 minutes). */
export const signedConnectRequest = async (
  search: string,
  auth: () => Auth = getAuth,
): Promise<ConnectRequest | null> => {
  const params = new URLSearchParams(search);
  const clientId = params.get("client_id");
  const redirectUri = params.get("redirect_uri");
  if (!clientId || !redirectUri || !params.get("sig")) return null;
  if (!(await isSignedConnectQuery(search, auth))) return null;
  return { clientId, redirectUri, scopes: (params.get("scope") ?? "").split(" ").filter(Boolean), search };
};

const asksToWrite = (scopes: readonly string[]) => scopes.includes(CONNECTOR_OAUTH_SCOPES.write);

/** The OAuth scopes to accept for a grant of `scope`: only ones the client asked for. */
export const acceptedOAuthScopes = (scope: ConnectorScope, requested: readonly string[]) => {
  const wanted: string[] = [CONNECTOR_OAUTH_SCOPES.read, CONNECTOR_OAUTH_SCOPES.offline];
  if (scope === "readWrite") wanted.push(CONNECTOR_OAUTH_SCOPES.write);
  return requested.filter((s) => wanted.includes(s));
};

/** The member's groups, each with its role and the recipient's name. */
const memberGroups = async (authUser: AuthUser) => {
  const groups = await careGroupService.list({ authUser }, { paginate: { page: 1, limit: 100 } });
  if (isError(groups)) return groups;
  const recipients = groups.data.length
    ? await careRecipientService.list(
        { authUser },
        { filter: { groupId: { type: "inArray", value: groups.data.map((g) => g.id) } } },
      )
    : { data: [] };
  if (isError(recipients)) return recipients;
  return groups.data.flatMap((group) => {
    const role = authUser.groupRoles?.[group.id];
    if (!role) return [];
    const recipient = recipients.data.find((r) => r.groupId === group.id);
    return [
      {
        id: group.id,
        name: group.name,
        recipientName: recipient ? recipient.preferredName || recipient.name : null,
        role,
        enabled: group.connectorsEnabled,
      },
    ];
  });
};

type MemberGroup = Exclude<Awaited<ReturnType<typeof memberGroups>>, AppError>[number];

const eligibleGroups = (groups: MemberGroup[], requested: readonly string[]) =>
  groups
    .filter((g) => g.enabled)
    .map(({ enabled: _enabled, ...group }): ConnectGroup => ({
      ...group,
      scopes: scopesForRole(group.role).filter((s) => s === "read" || asksToWrite(requested)),
    }));

/** The groups with the switch off, with the member's last request to each one's owners. */
const offGroups = async (authUser: AuthUser, groups: MemberGroup[]) => {
  const off: OffGroup[] = [];
  for (const { enabled, ...group } of groups) {
    if (enabled) continue;
    let askedAt: string | null = null;
    if (group.role !== "owner") {
      const last = await assistantRequestService.latest({ authUser }, group.id);
      if (isError(last)) return last;
      askedAt = last ? new Date(last.requestedAt).toISOString() : null;
    }
    off.push({ ...group, askedAt });
  }
  return off;
};

/** The consent page for a signed-in member; `invalid` for a query the plugin didn't sign, or an expired one. */
export const loadConnectPage = async (
  authUser: AuthUser,
  search: string,
  auth: () => Auth = getAuth,
): Promise<ConnectPage | AppError> => {
  const signed = await signedConnectRequest(search, auth);
  if (!signed) return { state: "invalid" };
  const client = await connectorGrantService.client(signed.clientId);
  if (isError(client)) return client;
  const host = hostOf(signed.redirectUri);
  if (!client || !host) return { state: "invalid" };
  const mine = await memberGroups(authUser);
  if (isError(mine)) return mine;
  const groups = eligibleGroups(mine, signed.scopes);
  const off = groups.length ? [] : await offGroups(authUser, mine);
  if (isError(off)) return off;
  return { state: "consent", client: { name: client.name, redirectHost: host }, groups, offGroups: off };
};

const field = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};

/**
 * Connect, or cancel. Connecting records the grant (one group, the scope,
 * the consent version), then the plugin's consent, which answers with the
 * client's redirect and a code. Cancelling answers with access denied and
 * connects nothing. `headers` are the member's request's (their session).
 */
export const submitConnectPage = async (
  {
    authUser,
    search,
    headers,
    form,
  }: { authUser: AuthUser; search: string; headers: Headers; form: FormData },
  auth: () => Auth = getAuth,
): Promise<ConnectOutcome | AppError> => {
  const signed = await signedConnectRequest(search, auth);
  if (!signed) return { error: "This request has expired. Start connecting again from your assistant." };
  const consent = (body: { accept: boolean; scope?: string }) =>
    auth().api.oauth2Consent({ body: { ...body, oauth_query: signed.search }, headers });

  if (field(form, "intent") === "cancel") return { redirect: (await consent({ accept: false })).url };

  const groupId = field(form, "groupId");
  const scope = field(form, "scope");
  if (!groupId) return { error: "Choose a care group." };
  if (!isConnectorScope(scope)) return { error: "Choose what the assistant may do." };
  if (field(form, "consent") !== "on") return { error: "Tick the box to agree first." };

  const accepted = acceptedOAuthScopes(scope, signed.scopes);
  if (!accepted.includes(CONNECTOR_OAUTH_SCOPES.read))
    return { error: "This assistant didn't ask to read a care group." };
  const effective: ConnectorScope =
    scope === "readWrite" && accepted.includes(CONNECTOR_OAUTH_SCOPES.write) ? "readWrite" : "read";
  const granted = await connectorGrantService.grant(
    { authUser },
    { clientId: signed.clientId, groupId, scope: effective, redirectUri: signed.redirectUri },
  );
  if (isError(granted)) {
    if (granted.code === "connectorGrantService:invalid")
      return { error: "This assistant's request isn't valid." };
    if (String(granted.code).startsWith("connectorGrantService:")) return { error: granted.message };
    return granted;
  }

  let redirect: string;
  try {
    redirect = (await consent({ accept: true, scope: accepted.join(" ") })).url;
  } catch (error) {
    // The plugin refused: nothing reaches the group without its tokens, but take the grant back.
    await connectorGrantService.revoke({ authUser }, granted.id);
    throw error;
  }
  const group = await careGroupService.getById({ authUser }, groupId);
  if (isError(group)) return group;
  return {
    redirect,
    connected: { groupName: group?.name ?? "your care group", clientName: granted.clientName },
  };
};
