export const DB_ERRORS = {
  "db:missingUrl": {
    message: "DATABASE_URL is not set",
  },
  "db:connect": {
    message: "Failed to connect to the database",
  },
  "db:transaction": {
    message: "Transaction failed",
  },
  "db:migrate": {
    message: "Failed to migrate the database",
  },
  "db:seed": {
    message: "Failed to seed the database",
  },
  "db:seed:production": {
    message: "Refusing to seed a production database",
  },
  "db:clear": {
    message: "Failed to clear the database",
  },
  "db:clear:notLocal": {
    message: "Refusing to clear a database that isn't on localhost",
  },
} as const;

export const MODEL_ERRORS = {
  "baseModel:create": {
    message: "Failed to create",
  },
  "baseModel:create:nothingCreated": {
    message: "Nothing created",
  },
  "baseModel:get": {
    message: "Failed to get. Do you have permission?",
  },
  "baseModel:list": {
    message: "Failed to list. Do you have permission to access the resources you requested?",
  },
  "baseModel:noFilter": {
    message: "A filter is required for this action",
    statusCode: 400,
  },
  "baseModel:filter:unknownField": {
    message: "Unknown filter field",
    statusCode: 400,
  },
  "baseModel:filter:unknownOperator": {
    message: "Unknown filter operator",
    statusCode: 400,
  },
  "baseModel:filter:emptyGroup": {
    message: "Filter groups (and/or) need at least one condition",
    statusCode: 400,
  },
  "baseModel:orderBy:unknownField": {
    message: "Unknown orderBy field",
    statusCode: 400,
  },
  "baseModel:remove": {
    message: "Error deleting. Do you have permission?",
  },
  "baseModel:remove:nothingRemoved": {
    message: "Nothing deleted. Do you have permission?",
  },
  "baseModel:update": {
    message: "Failed to update. Do you have permission?",
  },
  "baseModel:update:nothingUpdated": {
    message: "Nothing updated. Do you have permission?",
  },
  "baseModel:upsert": {
    message: "Failed to upsert. Do you have permission?",
  },
  "baseModel:scopeCheck": {
    message: "Failed to check permissions for the data being written",
  },
  "careGroupMemberModel:getRole": {
    message: "Failed to look up group role",
  },
  "careGroupMemberModel:lockOwners": {
    message: "Failed to lock group owners",
  },
  "careGroupMemberModel:insertFirstOwner": {
    message: "Failed to add the group's first owner",
  },
  "timelineEntryModel:badCursor": {
    message: "Invalid page cursor",
    statusCode: 400,
  },
  "timelineEntryModel:list": {
    message: "Failed to list timeline entries",
  },
  "timelineEntryModel:latestReadings": {
    message: "Failed to load the latest vitals",
  },
  "timelineEntryModel:remove": {
    message: "Failed to delete the timeline entry",
  },
  "noteDocumentModel:lock": {
    message: "Failed to lock the live document",
  },
  "noteDocumentModel:pending": {
    message: "Failed to count the live document's pending updates",
  },
  "providerModel:remove": {
    message: "Failed to delete the provider",
  },
  "userModel:notFound": {
    message: "User not found",
    statusCode: 404,
  },
} as const;

export const SERVICE_ERRORS = {
  "userService:notFound": {
    message: "No user found",
    statusCode: 404,
  },
  "careGroupService:notFound": {
    message: "Care group not found",
    statusCode: 404,
  },
  "careGroupMemberService:notFound": {
    message: "Group member not found",
    statusCode: 404,
  },
  "careGroupMemberService:ownerOnly": {
    message: "Only an owner can add, change or remove owners",
    statusCode: 403,
  },
  "careGroupMemberService:lastOwner": {
    message: "A care group needs at least one owner. Make someone else an owner first.",
    statusCode: 409,
  },
  "careGroupInviteService:ownerOnly": {
    message: "Only an owner can invite someone as an owner",
    statusCode: 403,
  },
  "timelineEntryService:invalid": {
    message: "The timeline entry is invalid",
    statusCode: 400,
  },
  "timelineEntryService:notFound": {
    message: "Timeline entry not found",
    statusCode: 404,
  },
  "timelineEntryService:noRecipient": {
    message: "This care group has no care recipient yet",
    statusCode: 409,
  },
  "timelineEntryService:immutable": {
    message: "An entry's group, recipient and kind can't change",
    statusCode: 400,
  },
  "timelineEntryService:recipientNotInGroup": {
    message: "That care recipient isn't in this care group",
    statusCode: 400,
  },
  "noteDocumentService:invalid": {
    message: "The live document change is invalid",
    statusCode: 400,
  },
  "noteDocumentService:notFound": {
    message: "Live document not found",
    statusCode: 404,
  },
  "noteDocumentService:entryNotFound": {
    message: "That entry is gone. It may have been deleted.",
    statusCode: 404,
  },
  "noteDocumentService:wrongKind": {
    message: "Only notes and events can have live notes",
    statusCode: 400,
  },
  "noteDocumentService:immutable": {
    message: "A live document's group and entry can't change",
    statusCode: 400,
  },
  "sync:readOnlyTable": {
    message: "Devices can't write to this table",
    statusCode: 403,
  },
  "careGroupInviteService:notFound": {
    message: "Invitation not found, or no longer pending",
    statusCode: 404,
  },
  "noteDocumentService:providerNotFound": {
    message: "That provider is gone. They may have been deleted.",
    statusCode: 404,
  },
  "providerService:invalid": {
    message: "The provider is invalid",
    statusCode: 400,
  },
  "providerService:notFound": {
    message: "Provider not found",
    statusCode: 404,
  },
  "providerService:immutable": {
    message: "A provider's group can't change",
    statusCode: 400,
  },
  "providerService:badPractice": {
    message: "The practice must be a practice or pharmacy in this care group",
    statusCode: 400,
  },
  "providerService:practiceInUse": {
    message: "Clinicians are linked to this practice. Move them to another practice first.",
    statusCode: 400,
  },
  "entryProviderService:invalid": {
    message: "The provider link is invalid",
    statusCode: 400,
  },
  "entryProviderService:entryNotFound": {
    message: "That entry is gone. It may have been deleted.",
    statusCode: 404,
  },
  "entryProviderService:providerNotFound": {
    message: "That provider is gone. They may have been deleted.",
    statusCode: 404,
  },
  "entryProviderService:wrongKind": {
    message: "Only notes and events can be linked to providers",
    statusCode: 400,
  },
  "entryProviderService:immutable": {
    message: "A link's entry and provider must be in its care group",
    statusCode: 400,
  },
} as const;

export const PERMISSION_ERRORS = {
  "permissions:unauthorized": {
    message: "Unauthorized",
    statusCode: 403,
  },
  "permissions:unauthenticated": {
    message: "Unauthenticated",
    statusCode: 401,
  },
  "permissions:fieldUnauthorized": {
    message: "You do not have permission to set one or more fields",
    statusCode: 403,
  },
} as const;

// @caretook/notifications: notify(), the outbox and the senders.
export const NOTIFICATION_ERRORS = {
  "notify:invalidData": {
    message: "The notification's data is invalid",
    statusCode: 400,
  },
  "notify:render": {
    message: "Failed to render the notification",
  },
  "notify:enqueue": {
    message: "Failed to queue the notification",
  },
  "notify:deliver": {
    message: "Failed to deliver queued notifications",
  },
  "notify:send": {
    message: "The mail sender refused the message",
  },
} as const;

export const ERRORS = {
  error: {
    message: "An error occurred",
  },
  ...DB_ERRORS,
  ...MODEL_ERRORS,
  ...SERVICE_ERRORS,
  ...PERMISSION_ERRORS,
  ...NOTIFICATION_ERRORS,
} as const;

export const ERROR_KEYS = Object.keys(ERRORS) as (keyof typeof ERRORS)[];
