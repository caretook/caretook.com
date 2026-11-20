import type { ValidateToken } from "@caretook/data";
import type { RateLimiter } from "../rateLimit";
import type { Tool } from "./registry";

import { connectorGrantService, isError, logError } from "@caretook/data";
import { OAUTH_SCOPES } from "@caretook/data/schema";
import { createRateLimiter, defaultStore } from "../rateLimit";
import { handleMcp, JSON_RPC } from "./protocol";
import { CONNECTOR_TOOLS } from "./tools";

// The /mcp endpoint over HTTP (MCP's Streamable HTTP, stateless): POST one
// JSON-RPC message, get one JSON answer. GET is 405 (no SSE streams), and
// there's no CORS: assistants call it server to server.
//
//   - No bearer token, or one that no longer reaches the group, is a 401
//     with the RFC 9728 `resource_metadata` pointer, so the client starts
//     the OAuth flow (or reconnects).
//   - A call to a write tool on a read-only connection is a 403
//     `insufficient_scope`.
//   - 60 calls a minute per connection (a looping assistant can't hammer
//     the database), then 429 with Retry-After.
//   - Logs follow the api rules: codes, the tool (`procedure`), the actor
//     and the group, never arguments or results.

/** Calls a connection may make in a minute. */
export const MCP_RATE_LIMIT = 60;
const MINUTE_MS = 60_000;

export type McpHandlerOptions = {
  /** Where the protected-resource metadata is (`${APP_URL}/.well-known/oauth-protected-resource/mcp`). */
  resourceMetadataUrl: string;
  /** Validates an access token through the OAuth plugin (`validateConnectorToken()`). */
  validate: ValidateToken;
  /** Origins a browser may call from (an Origin header from anywhere else is refused). */
  allowedOrigins?: readonly string[];
  limiter?: RateLimiter;
  tools?: readonly Tool[];
  now?: () => Date;
};

const json = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...headers },
  });

const rpcError = (code: number, message: string) => ({ jsonrpc: "2.0", id: null, error: { code, message } });

/** The bearer token in `Authorization`, if there's exactly one. */
const bearerToken = (request: Request) => {
  const match = /^Bearer\s+([^\s,]+)\s*$/i.exec(request.headers.get("authorization") ?? "");
  return match?.[1] ?? null;
};

/** The tool a message calls, for logs (a plain name only). */
const toolNameOf = (message: unknown) => {
  const name = (message as { params?: { name?: unknown } } | null)?.params?.name;
  return typeof name === "string" && /^[a-z_]{1,64}$/.test(name) ? `mcp.${name}` : "mcp";
};

export const createMcpHandler = ({
  resourceMetadataUrl,
  validate,
  allowedOrigins = [],
  limiter = createRateLimiter({
    limit: MCP_RATE_LIMIT,
    windowMs: MINUTE_MS,
    store: defaultStore("connector"),
  }),
  tools = CONNECTOR_TOOLS,
  now = () => new Date(),
}: McpHandlerOptions) => {
  const challenge = (extra = "") =>
    `Bearer ${extra}resource_metadata="${resourceMetadataUrl}", scope="${OAUTH_SCOPES.join(" ")}"`;
  const unauthorized = (invalid: boolean) =>
    json(rpcError(JSON_RPC.invalidRequest, "Unauthorized"), 401, {
      "www-authenticate": challenge(invalid ? 'error="invalid_token", ' : ""),
    });

  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return json(rpcError(JSON_RPC.invalidRequest, "Method not allowed: POST one JSON-RPC message"), 405, {
        allow: "POST",
      });
    }
    const origin = request.headers.get("origin");
    if (origin && !allowedOrigins.includes(origin))
      return json(rpcError(JSON_RPC.invalidRequest, "Forbidden"), 403);

    const token = bearerToken(request);
    if (!token) return unauthorized(false);

    const verified = await connectorGrantService.verify(token, validate);
    if (isError(verified)) {
      if (verified.code === "connectorGrantService:invalidToken") return unauthorized(true);
      logError("mcp: verify failed", verified, { procedure: "mcp" });
      return json(rpcError(JSON_RPC.internalError, "Something went wrong"), 500);
    }
    const fields = { actorId: verified.authUser.id, groupId: verified.groupId };

    if (!(await limiter.hit(verified.grantId))) {
      return json(rpcError(JSON_RPC.invalidRequest, "Too many requests: wait a minute"), 429, {
        "retry-after": "60",
      });
    }

    let message: unknown;
    try {
      message = await request.json();
    } catch {
      return json(rpcError(JSON_RPC.parseError, "Parse error: the body must be one JSON-RPC message"), 400);
    }

    try {
      const reply = await handleMcp(message, { ...verified, now: now() }, tools);
      if (reply.kind === "accepted") return new Response(null, { status: 202 });
      if (reply.kind === "insufficientScope") {
        return json(reply.body, 403, { "www-authenticate": challenge('error="insufficient_scope", ') });
      }
      return json(reply.body, 200);
    } catch (error) {
      logError("mcp: tool failed", error, { procedure: toolNameOf(message), ...fields });
      const id = (message as { id?: unknown } | null)?.id;
      return json(
        {
          jsonrpc: "2.0",
          id: typeof id === "string" || typeof id === "number" ? id : null,
          error: { code: JSON_RPC.internalError, message: "Something went wrong" },
        },
        500,
      );
    }
  };
};
