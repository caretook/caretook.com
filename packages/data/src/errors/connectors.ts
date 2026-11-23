// Connecting a member's own AI assistant to one care group (connectors PRD):
// connectorGrantService, the group switch and /mcp.
import { CONNECTOR_READ_ONLY_BY_OWNER_LABEL } from "../db/schema/connectors/connectorRules";

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
  "connectorGrantService:groupReadOnly": {
    message: `${CONNECTOR_READ_ONLY_BY_OWNER_LABEL}. An assistant can connect to this care group to read only.`,
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
  // assistantRequestService (connectors-2): asking the owners to turn assistants on.
  "assistantRequestService:notMember": {
    message: "Care group not found",
    statusCode: 404,
  },
  "assistantRequestService:owner": {
    message: "You're an owner, so you can turn Assistants on yourself in the group's settings",
    statusCode: 403,
  },
  "assistantRequestService:alreadyOn": {
    message: "Assistants are already on for this care group",
    statusCode: 409,
  },
  "assistantRequestModel:lockMembership": { message: "Failed to look up the membership" },
  "careGroupService:connectorsOwnerOnly": {
    message: "Only an owner can change this care group's Assistants settings",
    statusCode: 403,
  },
  // assistantActionService.run: an action the batch can't carry out. `meta.index` names it.
  "assistantActionService:invalid": {
    message: "This action can't be saved as it is",
    statusCode: 400,
  },
  "assistantActionService:medicationGone": {
    message: "That medication is gone. It may have been deleted.",
    statusCode: 404,
  },
  "assistantActionService:medicationStopped": {
    message: "That medication isn't current. Restart it in the app to log doses of it.",
    statusCode: 409,
  },
  "assistantActionService:providerGone": {
    message: "That provider is gone. It may have been deleted.",
    statusCode: 404,
  },
  "assistantActionService:passGone": {
    message: "That pass is gone. It may have been deleted.",
    statusCode: 404,
  },
  "assistantActionService:passEmpty": {
    message: "That pass has no medications.",
    statusCode: 409,
  },
  "assistantActionService:nothingLeft": {
    message: "Nothing is left to give in that pass today.",
    statusCode: 409,
  },
  // Edits (connectors-2): an entry not in the group reads the same as one that doesn't exist.
  "assistantActionService:entryNotFound": {
    message: "That entry wasn't found in this care group.",
    statusCode: 404,
  },
  "assistantActionService:entryDeleted": {
    message: "That entry was deleted, so it can't be changed.",
    statusCode: 409,
  },
  "assistantActionService:notEditable": {
    message: "Only notes and events can be changed this way. Change symptoms, vitals and doses in the app.",
    statusCode: 409,
  },
  // Conditions (connectors-2): one not in the group reads the same as one that doesn't exist.
  "assistantActionService:conditionNotFound": {
    message: "That condition wasn't found in this care group.",
    statusCode: 404,
  },
  "assistantActionService:conditionDeleted": {
    message: "That condition was deleted, so it can't be changed.",
    statusCode: 409,
  },
  // The grant model's own queries (database failures).
  "connectorGrantModel:revoke": { message: "Failed to revoke the connection" },
  "connectorGrantModel:revokeAll": { message: "Failed to revoke connections" },
  "connectorGrantModel:revokeTokens": { message: "Failed to revoke a connection's tokens" },
  "connectorGrantModel:getLive": { message: "Failed to load the connection" },
  "connectorGrantModel:touch": { message: "Failed to record the connection's use" },
  "connectorGrantModel:getClient": { message: "Failed to load the assistant's registration" },
} as const;
