import type { BetterAuthPlugin } from "better-auth";
import type { ValidatedToken } from "@caretook/data";

import { getOAuthProviderApi, oauthProvider, verifyOAuthQueryParams } from "@better-auth/oauth-provider";
import { createAuthEndpoint } from "better-auth/api";
import {
  OAUTH_SCOPES,
  oauthAccessTokenSchema,
  oauthClientAssertionSchema,
  oauthClientResourceSchema,
  oauthClientSchema,
  oauthConsentSchema,
  oauthRefreshTokenSchema,
  oauthResourceSchema,
} from "@caretook/data/schema";

// Connecting a member's own AI assistant (connectors PRD): Better Auth's
// OAuth 2.1 provider plugin issues the tokens, and a grant in
// connector_grant (connectorGrantService) says which one group they reach.
//
//   - Authorization code with PKCE (S256 only), dynamic registration for
//     public clients (as Claude and ChatGPT register), rotating refresh
//     tokens (30 days), revocation, and the authorization-server metadata.
//   - Access tokens are opaque (1 hour), stored hashed: revocable at once,
//     and the jwt plugin stays PowerSync's.
//   - The login step and the consent step are both /connect: it sends the
//     member to /sign-in?redirectTo=… first, then shows our consent page
//     (one group, the scope, the consent text).
//   - No session-backed client admin: registration is the only way in.

/** Our consent page, which is also where the plugin sends a signed-out member. */
export const CONNECT_PAGE = "/connect";

/** The MCP endpoint, the one protected resource tokens are issued for. */
export const mcpResourceUrl = (origin: string) => `${origin.replace(/\/$/, "")}/mcp`;

// The plugin's endpoints we don't use (client and consent admin, OIDC's
// userinfo and logout): 404 over HTTP. `clientPrivileges`
// refuses the client admin ones anyway.
export const CONNECTOR_DISABLED_PATHS = [
  "/oauth2/create-client",
  "/oauth2/get-client",
  "/oauth2/get-clients",
  "/oauth2/update-client",
  "/oauth2/delete-client",
  "/oauth2/client/rotate-secret",
  "/oauth2/client/rotate-keys",
  "/oauth2/public-client",
  "/oauth2/public-client-prelogin",
  "/oauth2/get-consent",
  "/oauth2/get-consents",
  "/oauth2/update-consent",
  "/oauth2/delete-consent",
  "/oauth2/userinfo",
  "/oauth2/end-session",
  "/oauth2/end-session/confirm",
  "/admin/oauth2/create-client",
  "/admin/oauth2/update-client",
  "/admin/oauth2/resources",
];

/** The OAuth provider plugin, configured for connectors. `origin` is BETTER_AUTH_URL. */
export const connectorOAuthProvider = (origin: string) => {
  const resource = mcpResourceUrl(origin);
  return oauthProvider({
    scopes: [...OAUTH_SCOPES],
    loginPage: CONNECT_PAGE,
    consentPage: CONNECT_PAGE,
    grantTypes: ["authorization_code", "refresh_token"],
    allowDynamicClientRegistration: true,
    allowUnauthenticatedClientRegistration: true,
    // A client that omits application_type is native when its redirect is
    // loopback or a custom scheme (desktop clients), else web.
    clientRegistrationDefaultApplicationType: "infer",
    accessTokenExpiresIn: 60 * 60,
    refreshTokenExpiresIn: 30 * 24 * 60 * 60,
    disableJwtPlugin: true,
    resources: [{ identifier: resource, name: "Caretook" }],
    clientRegistrationDefaultResources: [resource],
    clientPrivileges: () => false,
    resourcePrivileges: () => false,
  });
};

const bodyString = (body: unknown, key: string) => {
  const value = body && typeof body === "object" ? (body as Record<string, unknown>)[key] : undefined;
  return typeof value === "string" ? value : "";
};

/** A Standard Schema for `{ [key]: string }` bodies (this package has no zod of its own). */
const stringBody = <K extends string>(key: K) => ({
  "~standard": {
    version: 1 as const,
    vendor: "caretook",
    validate: (value: unknown) =>
      bodyString(value, key)
        ? { value: value as Record<K, string> }
        : { issues: [{ message: `${key} is required` }] },
    types: undefined as unknown as { input: Record<K, string>; output: Record<K, string> },
  },
});

/**
 * Two server-only endpoints over the plugin (never served over HTTP):
 * validating a connector's access token for /mcp, and checking the signed
 * query the plugin sent to /connect before the page shows it.
 */
export const connectorTokens = (origin: string) =>
  ({
    id: "caretook-connectors",
    endpoints: {
      verifyConnectorToken: createAuthEndpoint(
        "/connector/verify-token",
        { method: "POST", body: stringBody("token"), metadata: { SERVER_ONLY: true } },
        async (ctx): Promise<{ active: false } | ({ active: true } & ValidatedToken)> => {
          const token = bodyString(ctx.body, "token");
          const plugin = ctx.context.getPlugin("oauth-provider");
          if (!token || !plugin) return { active: false };
          let payload: Awaited<
            ReturnType<ReturnType<typeof getOAuthProviderApi>["requireActiveAccessToken"]>
          >;
          try {
            payload = await getOAuthProviderApi(ctx, plugin.options).requireActiveAccessToken(token);
          } catch (error) {
            // An unknown, expired or revoked token is the plugin's APIError.
            if (error && typeof error === "object" && "status" in error) return { active: false };
            throw error;
          }
          const audience = payload.aud === undefined ? [] : [payload.aud].flat();
          if (audience.length && !audience.includes(mcpResourceUrl(origin))) return { active: false };
          const userId = typeof payload.sub === "string" ? payload.sub : "";
          const clientId = typeof payload.client_id === "string" ? payload.client_id : "";
          if (!userId || !clientId) return { active: false };
          const scopes = typeof payload.scope === "string" ? payload.scope.split(" ").filter(Boolean) : [];
          return { active: true, userId, clientId, scopes };
        },
      ),
      checkConnectorQuery: createAuthEndpoint(
        "/connector/check-query",
        { method: "POST", body: stringBody("query"), metadata: { SERVER_ONLY: true } },
        async (ctx) => ({
          valid: await verifyOAuthQueryParams(bodyString(ctx.body, "query"), ctx.context.secret),
        }),
      ),
    },
  }) satisfies BetterAuthPlugin;

/** The plugin's models (Better Auth's names) → our tables (db/schema/auth/oauth.ts). */
export const connectorAuthSchema = {
  oauthClient: oauthClientSchema,
  oauthResource: oauthResourceSchema,
  oauthClientResource: oauthClientResourceSchema,
  oauthRefreshToken: oauthRefreshTokenSchema,
  oauthAccessToken: oauthAccessTokenSchema,
  oauthConsent: oauthConsentSchema,
  oauthClientAssertion: oauthClientAssertionSchema,
};
