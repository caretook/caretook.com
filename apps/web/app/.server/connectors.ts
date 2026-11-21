// The web app's door for connectors (server only; see data.ts for why
// .server/): /connect's loader and action, /mcp, and the two discovery
// documents. Members' own AI assistants (connectors PRD); the work is in
// @caretook/api's connectors module.
import type { ConnectedTo, ConnectPage } from "@caretook/api";

import {
  createMcpHandler,
  loadConnectPage,
  protectedResourceMetadata as resourceMetadata,
  resourceMetadataUrl,
  submitConnectPage,
} from "@caretook/api";
import {
  allowedOrigins,
  connectorAuthServerMetadata,
  getAuthConfig,
  getAuthUser,
  validateConnectorToken,
} from "@caretook/auth";
import { isError, logError } from "@caretook/data";
import { redirect } from "react-router";
import { signInUrl } from "~/lib/core/redirect";

export type { ConnectGroup, ConnectPage } from "@caretook/api";

/** The success step's data: who was connected where, and the client's redirect (with its code). */
export type ConnectSuccessData = ConnectedTo & { redirect: string };

/** Our public origin (BETTER_AUTH_URL, which deploys keep equal to APP_URL). */
const origin = () => (getAuthConfig().baseURL ?? "http://localhost:5173").replace(/\/$/, "");

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

/** RFC 9728's protected-resource metadata for /mcp: where to get a token, and what for. */
export const protectedResourceMetadata = () =>
  Response.json(resourceMetadata(origin()), { headers: { "cache-control": "public, max-age=300" } });

/** RFC 8414's authorization-server metadata (the plugin's), at the root as well as under the issuer. */
export const authorizationServerMetadata = (request: Request) => connectorAuthServerMetadata(request);

// ---------------------------------------------------------------------------
// /mcp
// ---------------------------------------------------------------------------

let mcp: ReturnType<typeof createMcpHandler> | undefined;

export const handleMcpRequest = (request: Request) => {
  mcp ??= createMcpHandler({
    resourceMetadataUrl: resourceMetadataUrl(origin()),
    validate: validateConnectorToken(),
    allowedOrigins: [origin(), ...allowedOrigins()],
  });
  return mcp(request);
};

// ---------------------------------------------------------------------------
// /connect
// ---------------------------------------------------------------------------

const failed = (event: string, error: Parameters<typeof logError>[1]) => {
  logError(event, error, { procedure: "connect" });
  return new Response("Something went wrong", { status: 500 });
};

const searchOf = (request: Request) => new URL(request.url).search.replace(/^\?/, "");

/**
 * The signed-in member, or a redirect to sign in and come back here. Read live,
 * not from the 3-minute cookie cache (B-140): consent mints 30-day tokens, so a
 * session ended elsewhere must not still grant one.
 */
const requireMember = async (request: Request) => {
  const authUser = await getAuthUser(request.headers, { live: true });
  if (isError(authUser)) throw failed("connect: session lookup failed", authUser);
  if (!authUser) throw redirect(signInUrl(request));
  return authUser;
};

/** The consent page's data; signed out, sign in first and come back. */
export const loadConnect = async (request: Request): Promise<ConnectPage> => {
  const page = await loadConnectPage(await requireMember(request), searchOf(request));
  if (isError(page)) throw failed("connect: load failed", page);
  return page;
};

/**
 * Connect or cancel. Cancel goes straight back to the assistant; Connect
 * answers with the success step's data (the page returns to the assistant
 * from there); a refusal comes back with what to fix.
 */
export const submitConnect = async (
  request: Request,
  form: FormData,
): Promise<{ error: string } | { connected: ConnectSuccessData }> => {
  const authUser = await requireMember(request);
  const outcome = await submitConnectPage({
    authUser,
    search: searchOf(request),
    headers: request.headers,
    form,
  });
  if (isError(outcome)) throw failed("connect: submit failed", outcome);
  if (!("redirect" in outcome)) return outcome;
  if (outcome.connected) return { connected: { ...outcome.connected, redirect: outcome.redirect } };
  throw redirect(outcome.redirect);
};
