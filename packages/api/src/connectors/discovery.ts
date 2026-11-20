import { OAUTH_SCOPES } from "@caretook/data/schema";

// OAuth discovery for /mcp. `origin` is our public origin (BETTER_AUTH_URL,
// which deploys keep equal to APP_URL); Better Auth's issuer is /api/auth.

/** Where the protected-resource metadata is: /mcp's 401 points here. */
export const resourceMetadataUrl = (origin: string) =>
  `${origin.replace(/\/$/, "")}/.well-known/oauth-protected-resource/mcp`;

/** RFC 9728's protected-resource metadata for /mcp: the resource, its authorization server and scopes. */
export const protectedResourceMetadata = (origin: string) => {
  const base = origin.replace(/\/$/, "");
  return {
    resource: `${base}/mcp`,
    authorization_servers: [`${base}/api/auth`],
    scopes_supported: [...OAUTH_SCOPES],
    bearer_methods_supported: ["header"],
    resource_name: "Caretook",
  };
};
