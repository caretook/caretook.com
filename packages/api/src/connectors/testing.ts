// Test-only (integration tests): the whole OAuth dance in process, as an
// assistant and a member's browser would do it, against the app's Better
// Auth instance: register a public client, authorize with PKCE, sign in,
// consent through /connect's server side, and exchange the code. Then /mcp
// as the assistant calls it: JSON-RPC posts and tool calls with those
// tokens. Never imported by app code.
import type { AuthUser, ConnectorScope } from "@caretook/data";
import type { McpHandlerOptions } from "./http";

import { getAuth, getAuthUser, validateConnectorToken } from "@caretook/auth";
import { accountSchema, getDb, isError, SYSTEM_USER, userModel } from "@caretook/data";
import { createHash, randomBytes } from "node:crypto";
import { createRateLimiter } from "../rateLimit";
import { submitConnectPage } from "./connect";
import { resourceMetadataUrl } from "./discovery";
import { createMcpHandler } from "./http";

export const TEST_ORIGIN = process.env.BETTER_AUTH_URL ?? "http://localhost:5173";
export const TEST_REDIRECT_URI = "https://assistant.example.com/oauth/callback";
const PASSWORD = "connectors test passphrase";

const authUrl = (path: string) => `${TEST_ORIGIN}/api/auth${path}`;

/** A request through Better Auth's HTTP handler, as the assistant's server makes it. */
export const authRequest = (path: string, init: RequestInit = {}) =>
  getAuth().handler(new Request(authUrl(path), init));

/** A form-encoded POST to Better Auth (the token and revocation endpoints). */
export const authForm = (path: string, fields: Record<string, string>) =>
  authRequest(path, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });

/** Register a public client, as Claude and ChatGPT do (dynamic registration, no secret). */
export const registerClient = async (name = "Test Claude", redirectUri = TEST_REDIRECT_URI) => {
  const res = await authRequest("/oauth2/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_name: name,
      redirect_uris: [redirectUri],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    }),
  });
  if (res.status !== 200 && res.status !== 201)
    throw new Error(`register failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as { client_id: string; client_name: string; scope: string };
};

/** A PKCE verifier and its S256 challenge. */
export const pkce = () => {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
};

/** Give `userId` a verified email and a password, so they can sign in. */
export const enablePasswordSignIn = async (userId: string) => {
  const context = await getAuth().$context;
  const verified = await userModel.update({
    authUser: SYSTEM_USER,
    filter: { id: { type: "eq", value: userId } },
    data: { emailVerified: true },
  });
  if (isError(verified)) throw new Error(`fixture failed: ${verified.code}`);
  await getDb()
    .insert(accountSchema)
    .values({
      userId,
      providerId: "credential",
      accountId: userId,
      password: await context.password.hash(PASSWORD),
    });
};

/** Sign `email` in; the cookie header a browser would then send. */
export const signInCookies = async (email: string, password = PASSWORD) => {
  const res = await getAuth().api.signInEmail({ body: { email, password }, asResponse: true });
  if (res.status !== 200) throw new Error(`sign-in failed: ${res.status}`);
  return new Headers({
    cookie: res.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; "),
  });
};

/** Where a redirect goes: a 302's Location, or the plugin's JSON `{ redirect, url }`. */
export const redirectOf = async (res: Response) => {
  const location = res.headers.get("location");
  if (location) return new URL(location, TEST_ORIGIN);
  const body = (await res.json()) as { url?: string };
  if (!body.url) throw new Error(`no redirect: ${res.status} ${JSON.stringify(body)}`);
  return new URL(body.url, TEST_ORIGIN);
};

/** Start the authorize step for `clientId`; the page the plugin sends the member to (/connect?…). */
export const authorize = async (
  clientId: string,
  {
    challenge,
    cookies,
    scope = "group:read group:write offline_access",
    state = "st",
  }: {
    challenge: string;
    cookies?: Headers;
    scope?: string;
    state?: string;
  },
) => {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: TEST_REDIRECT_URI,
    scope,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    resource: `${TEST_ORIGIN}/mcp`,
  });
  const res = await authRequest(`/oauth2/authorize?${params}`, { headers: cookies ?? {} });
  return redirectOf(res);
};

/** The consent form /connect posts. */
export const connectForm = (fields: Record<string, string>) => {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return form;
};

/** Exchange an authorization code (PKCE) for tokens. */
export const exchangeCode = (clientId: string, code: string, verifier: string) =>
  authForm("/oauth2/token", {
    grant_type: "authorization_code",
    code,
    redirect_uri: TEST_REDIRECT_URI,
    client_id: clientId,
    code_verifier: verifier,
    resource: `${TEST_ORIGIN}/mcp`,
  });

export type Tokens = { access_token: string; refresh_token: string; scope: string; expires_in: number };

/**
 * The whole dance for a member already able to sign in (`enablePasswordSignIn`):
 * a new client, consent to `groupId` with `scope`, and the tokens.
 */
export const connectAssistant = async ({
  email,
  groupId,
  scope = "readWrite",
  clientName = "Test Claude",
  password,
}: {
  email: string;
  groupId: string;
  scope?: ConnectorScope;
  clientName?: string;
  /** For a seeded member, whose password isn't the fixtures' (browser checks). */
  password?: string;
}) => {
  const client = await registerClient(clientName);
  const { verifier, challenge } = pkce();
  const cookies = await signInCookies(email, password);
  const consentPage = await authorize(client.client_id, { challenge, cookies });
  const authUser = (await getAuthUser(cookies)) as AuthUser;
  const outcome = await submitConnectPage({
    authUser,
    search: consentPage.search.slice(1),
    headers: cookies,
    form: connectForm({ groupId, scope, consent: "on", intent: "connect" }),
  });
  if (isError(outcome) || !("redirect" in outcome))
    throw new Error(`connect failed: ${JSON.stringify(outcome)}`);
  const code = new URL(outcome.redirect).searchParams.get("code");
  if (!code) throw new Error(`no code: ${outcome.redirect}`);
  const res = await exchangeCode(client.client_id, code, verifier);
  if (res.status !== 200) throw new Error(`token failed: ${res.status} ${await res.text()}`);
  return { clientId: client.client_id, tokens: (await res.json()) as Tokens, cookies, authUser };
};

// ---------------------------------------------------------------------------
// /mcp: one JSON-RPC message per POST, with a bearer token.
// ---------------------------------------------------------------------------

/** /mcp's handler as tests run it: real token validation, a limit no test reaches unless it sets its own. */
export const mcpHandler = (options: Partial<McpHandlerOptions> = {}) =>
  createMcpHandler({
    resourceMetadataUrl: resourceMetadataUrl(TEST_ORIGIN),
    validate: validateConnectorToken(),
    limiter: createRateLimiter({ limit: 10_000, windowMs: 60_000 }),
    ...options,
  });
export type McpHandler = ReturnType<typeof mcpHandler>;

let nextRpcId = 1;
/** A JSON-RPC request (each with its own id). */
export const rpc = (method: string, params?: unknown) => ({
  jsonrpc: "2.0",
  id: nextRpcId++,
  method,
  ...(params ? { params } : {}),
});
/** A tools/call request. */
export const toolRequest = (name: string, args: Record<string, unknown> = {}) =>
  rpc("tools/call", { name, arguments: args });

/** POST one JSON-RPC message to /mcp, as an assistant's server does (`token` null: none). */
export const mcpPost = (handler: McpHandler, token: string | null, body: unknown) =>
  handler(
    new Request(`${TEST_ORIGIN}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    }),
  );

/** A tool's answer: its text, its structured content, and isError for a refusal the model can fix. */
export type ToolResult = {
  content: { type: string; text: string }[];
  structuredContent: Record<string, unknown> & { url?: string | null; entryIds?: string[]; todoId?: string };
  isError?: boolean;
};

/** A tools/call answer's result (anything but a 200 throws). */
export const toolResultOf = async (res: Response) => {
  if (res.status !== 200) throw new Error(`/mcp answered ${res.status}: ${await res.text()}`);
  return ((await res.json()) as { result: ToolResult }).result;
};

/** Call a tool with `token`: its result. */
export const callTool = async (
  handler: McpHandler,
  token: string,
  name: string,
  args: Record<string, unknown> = {},
) => toolResultOf(await mcpPost(handler, token, toolRequest(name, args)));

/** A result's text, its parts joined by newlines. */
export const textOf = (result: ToolResult) => result.content.map((c) => c.text).join("\n");
