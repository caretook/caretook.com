import { type RouteConfigEntry, route } from "@react-router/dev/routes";

// Connectors (web only): members' own AI assistants over MCP. The consent
// page (also where OAuth sends a signed-out member, on to /sign-in), the MCP
// endpoint, and the OAuth discovery documents: RFC 9728's for /mcp, and RFC
// 8414's for the issuer (/api/auth), each at its RFC's path and at the root.
export const connectorRoutes: RouteConfigEntry[] = [
  route("connect", "routes/connectors/connect/route.tsx"),
  route("mcp", "routes/connectors/mcp/route.ts"),
  route(".well-known/oauth-protected-resource/mcp", "routes/connectors/well-known/protected-resource.ts"),
  route(".well-known/oauth-protected-resource", "routes/connectors/well-known/protected-resource-root.ts"),
  route(
    ".well-known/oauth-authorization-server/api/auth",
    "routes/connectors/well-known/authorization-server.ts",
  ),
  route(
    ".well-known/oauth-authorization-server",
    "routes/connectors/well-known/authorization-server-root.ts",
  ),
];
