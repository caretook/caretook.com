import { ADMIN_ERRORS } from "./admin";
import { APPOINTMENTS_ERRORS } from "./appointments";
import { AUTH_ERRORS } from "./auth";
import { CALENDARS_ERRORS } from "./calendars";
import { CARE_GROUPS_ERRORS } from "./care-groups";
import { CARE_PERIODS_ERRORS } from "./care-periods";
import { CONNECTORS_ERRORS } from "./connectors";
import { CORE_ERRORS } from "./core";
import { LIVE_NOTES_ERRORS } from "./live-notes";
import { MARKETING_ERRORS } from "./marketing";
import { MEDICATIONS_ERRORS } from "./medications";
import { NOTIFICATION_SERVICE_ERRORS } from "./notifications";
import { PROFILES_ERRORS } from "./profiles";
import { PROVIDERS_ERRORS } from "./providers";
import { SEARCH_ERRORS } from "./search";
import { SYNC_ERRORS } from "./sync";
import { TAGS_ERRORS } from "./tags";
import { TODOS_ERRORS } from "./todos";
import { TIMELINE_ERRORS } from "./timeline";

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
  "db:seed:notLocal": {
    message: "Refusing to seed a database that isn't on localhost (set APP_ENV=staging for staging)",
  },
  "db:seed:password": {
    message: "Refusing to seed staging without a secret SEED_USER_PASSWORD (not the dev default)",
  },
  "db:seed:appEnv": {
    message: 'Refusing to seed: APP_ENV must be "staging" or unset',
  },
  "db:seed:linkKey": {
    message: "Refusing to seed staging without INVITE_LINK_KEY (the server's key, so seeded links open)",
  },
  "db:reset": {
    message: "Failed to reset staging",
  },
  "db:reset:notStaging": {
    message: "Refusing to reset: only staging (APP_ENV=staging) can be wiped and reseeded",
  },
  "db:reset:cycle": {
    message: "Refusing to reset: tables reference each other in a cycle, so there is no safe delete order",
  },
  "db:clear": {
    message: "Failed to clear the database",
  },
  "db:clear:notLocal": {
    message: "Refusing to clear a database that isn't on localhost",
  },
  "db:roles": {
    message: "Failed to apply the database roles",
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
  "careGroupMemberModel:lockGroupMembers": {
    message: "Failed to lock group members",
  },
  "careGroupMemberModel:accountStatuses": {
    message: "Failed to read members' account status",
  },
  "careGroupMemberModel:listForUser": {
    message: "Failed to list the user's memberships",
  },
  "careRecipientDetailsModel:lockForGroup": {
    message: "Failed to lock the care recipient's details",
  },
  "careGroupMemberModel:insertFirstOwner": {
    message: "Failed to add the group's first owner",
  },
  "careGroupInviteModel:getByToken": {
    message: "Failed to look up the invitation",
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
  "timelineEntryModel:mayChange": {
    message: "Failed to check access to the timeline entry",
  },
  "timelineEntryModel:restore": {
    message: "Failed to restore the timeline entry",
  },
  "timelineEntryModel:lock": {
    message: "Failed to lock the timeline entry",
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
  "providerModel:lock": {
    message: "Failed to lock the provider",
  },
  "medicationModel:remove": {
    message: "Failed to delete the medication",
  },
  "medicationPassModel:remove": {
    message: "Failed to delete the med time",
  },
  "medicationPassModel:lock": {
    message: "Failed to lock the med time",
  },
  "recipientAllergyModel:remove": {
    message: "Failed to delete the allergy",
  },
  "userModel:notFound": {
    message: "User not found",
    statusCode: 404,
  },
  "userModel:notWhole": {
    message: "Only the user's public profile is readable",
    statusCode: 403,
  },
  "userModel:getAuthFacts": {
    message: "Failed to look up the signed-in user",
  },
  "careGroupInviteModel:getSealedToken": {
    message: "Failed to read the invite link",
  },
  "careGroupJoinRequestModel:lock": {
    message: "Failed to look up the join request",
    statusCode: 403,
  },
  "accessCodeModel:getByCode": {
    message: "Failed to look up the access code",
  },
  "accessCodeModel:countUse": {
    message: "Failed to count the access code's use",
  },
  "waitlistEntryModel:upsertByEmail": {
    message: "Failed to save the waitlist entry",
  },
  "waitlistEntryModel:search": {
    message: "Failed to search the waitlist",
  },
  "carePeriodModel:remove": {
    message: "Failed to delete the care period",
  },
  "appointmentSeriesModel:remove": {
    message: "Failed to delete the repeating series",
  },
  "appointmentSeriesModel:topUpZones": {
    message: "Failed to read the repeating series' time zones",
  },
  "appointmentSeriesModel:listDueForTopUp": {
    message: "Failed to read the repeating series due a top-up",
  },
  "todoModel:remove": {
    message: "Failed to delete the todo",
  },
  "todoModel:restore": {
    message: "Failed to restore the todo",
  },
  "todoModel:lockById": {
    message: "Failed to lock the todo",
  },
  "todoModel:transactionNow": {
    message: "Failed to read the database's clock",
  },
  "adminAuditLogModel:insert": {
    message: "Failed to record the audit entry",
  },
  "adminAuditLogModel:search": {
    message: "Failed to search the audit log",
  },
  "adminAuditLogModel:actors": {
    message: "Failed to list the audit log's staff",
  },
  "groupDirectoryModel:search": {
    message: "Failed to search care groups",
  },
  "groupDirectoryModel:owners": {
    message: "Failed to list the care groups' owners",
  },
  "groupDirectoryModel:get": {
    message: "Failed to look up the care group",
  },
  "groupDirectoryModel:members": {
    message: "Failed to list the care group's members",
  },
  "groupDirectoryModel:activity": {
    message: "Failed to count the care group's activity",
  },
  "appSettingModel:all": {
    message: "Failed to read the settings",
  },
  "appSettingModel:get": {
    message: "Failed to read the setting",
  },
  "appSettingModel:put": {
    message: "Failed to save the setting",
  },
} as const;

// Service errors live in one part per area (`./<area>.ts`); a new error goes in its
// area's part. Codes must be unique across parts (errors.test.ts).
export const SERVICE_ERRORS = {
  ...ADMIN_ERRORS,
  ...APPOINTMENTS_ERRORS,
  ...AUTH_ERRORS,
  ...CALENDARS_ERRORS,
  ...CARE_GROUPS_ERRORS,
  ...CARE_PERIODS_ERRORS,
  ...CONNECTORS_ERRORS,
  ...CORE_ERRORS,
  ...LIVE_NOTES_ERRORS,
  ...MARKETING_ERRORS,
  ...MEDICATIONS_ERRORS,
  ...NOTIFICATION_SERVICE_ERRORS,
  ...PROFILES_ERRORS,
  ...PROVIDERS_ERRORS,
  ...SEARCH_ERRORS,
  ...SYNC_ERRORS,
  ...TAGS_ERRORS,
  ...TODOS_ERRORS,
  ...TIMELINE_ERRORS,
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
