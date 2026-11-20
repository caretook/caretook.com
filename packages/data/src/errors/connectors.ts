// Connecting a member's own AI assistant to one care group (connectors PRD):
// connectorGrantService, the group switch and /mcp.
export const CONNECTORS_ERRORS = {
  "connectorGrantService:disabled": {
    message: "This care group doesn't allow assistants. Ask an owner to turn Assistants on.",
    statusCode: 403,
  },
  "connectorGrantService:notMember": {
    message: "Care group not found",
    statusCode: 404,
  },
  "connectorGrantService:scopeNotAllowed": {
    message: "Your role in this care group can connect an assistant for reading only",
    statusCode: 403,
  },
  "connectorGrantService:invalid": {
    message: "The connection is invalid",
    statusCode: 400,
  },
  "connectorGrantService:notFound": {
    message: "Connection not found",
    statusCode: 404,
  },
  "connectorGrantService:notAllowed": {
    message: "You can't disconnect that assistant",
    statusCode: 403,
  },
  // Every way a token stops reaching the group reads the same to the
  // assistant: it has to reconnect (a 401 with the bearer challenge).
  "connectorGrantService:invalidToken": {
    message: "The access token is invalid, expired or disconnected",
    statusCode: 401,
  },
  "careGroupService:connectorsOwnerOnly": {
    message: "Only an owner can turn assistants on or off",
    statusCode: 403,
  },
  // The grant model's own queries (database failures).
  "connectorGrantModel:revoke": { message: "Failed to revoke the connection" },
  "connectorGrantModel:revokeAll": { message: "Failed to revoke connections" },
  "connectorGrantModel:revokeTokens": { message: "Failed to revoke a connection's tokens" },
  "connectorGrantModel:getLive": { message: "Failed to load the connection" },
  "connectorGrantModel:touch": { message: "Failed to record the connection's use" },
  "connectorGrantModel:getClient": { message: "Failed to load the assistant's registration" },
} as const;
