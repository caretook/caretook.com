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
  "careGroupMemberModel:lockGroupMembers": {
    message: "Failed to lock group members",
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
    message: "Failed to delete the pass",
  },
  "medicationPassModel:lock": {
    message: "Failed to lock the pass",
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
  "providerService:practiceHasProviders": {
    message: "Providers are linked to this practice. Move them to another practice, or delete them, first.",
    statusCode: 409,
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
  "careGroupInviteService:notAllowed": {
    message: "You can't invite someone with that role",
    statusCode: 403,
  },
  "careGroupInviteService:notAttested": {
    message: "Confirm the care recipient agreed to share with this person first",
    statusCode: 400,
  },
  "careGroupInviteService:alreadyMember": {
    message: "That person is already in this care group",
    statusCode: 409,
  },
  "careGroupInviteService:alreadyInvited": {
    message: "That address already has an invitation waiting. Send it again instead.",
    statusCode: 409,
  },
  "careGroupInviteService:unusable": {
    message: "This invitation can't be used any more",
    statusCode: 409,
  },
  "careGroupInviteService:wrongEmail": {
    message: "This invitation is for a different email address",
    statusCode: 403,
  },
  "careGroupInviteService:noConsent": {
    message: "Agree to what the care group shares before joining",
    statusCode: 400,
  },
  "careGroupInviteService:wrongKind": {
    message: "That isn't an email invitation",
    statusCode: 400,
  },
  "ticket:invalid": {
    message: "This invitation can't be used to create an account",
    statusCode: 403,
  },
  "ticket:emailMismatch": {
    message: "Use the email address the invitation was sent to",
    statusCode: 400,
  },
  "ticket:accountExists": {
    message: "An account with this email already exists. Sign in instead.",
    statusCode: 409,
  },
  "ticket:weakPassword": {
    message: "Use at least 12 characters",
    statusCode: 400,
  },
  "careGroupInviteService:linkRole": {
    message: "An invite link can make caretakers and viewers only",
    statusCode: 403,
  },
  "careGroupInviteService:notLink": {
    message: "That isn't an invite link",
    statusCode: 400,
  },
  "careGroupInviteService:linkInactive": {
    message: "That link has expired, been used up or been withdrawn, so it can't be copied",
    statusCode: 409,
  },
  "careGroupInviteService:linkKeyMissing": {
    message: "INVITE_LINK_KEY is not set, so invite links can't be made",
  },
  "joinRequestService:notFound": {
    message: "That request is no longer waiting",
    statusCode: 404,
  },
  "joinRequestService:notAllowed": {
    message: "Only the care group's owners and admins can answer requests to join",
    statusCode: 403,
  },
  "accessCodeService:notFound": {
    message: "That access code isn't valid",
    statusCode: 404,
  },
  "accessCodeService:unusable": {
    message: "This access code can't be used any more",
    statusCode: 409,
  },
  "accessCodeService:invalid": {
    message: "Check the form and try again",
    statusCode: 400,
  },
  "accessCodeService:noUniqueCode": {
    message: "Couldn't make a new access code. Try again.",
  },
  "staffGroupService:staffOnly": {
    message: "Only Caretook staff can do that",
    statusCode: 403,
  },
  "careRecipientService:invalidTimeZone": {
    message: "The care recipient needs a valid time zone",
    statusCode: 400,
  },
  "medicationService:invalid": {
    message: "The medication is invalid",
    statusCode: 400,
  },
  "medicationService:notFound": {
    message: "Medication not found",
    statusCode: 404,
  },
  "medicationService:immutable": {
    message: "A medication's group and recipient can't change",
    statusCode: 400,
  },
  "medicationService:noRecipient": {
    message: "This care group has no care recipient yet",
    statusCode: 409,
  },
  "medicationService:recipientNotInGroup": {
    message: "That care recipient isn't in this care group",
    statusCode: 400,
  },
  "medicationService:badPrescriber": {
    message: "The prescriber must be a clinician or practice in this care group",
    statusCode: 400,
  },
  "medicationService:badPharmacy": {
    message: "The pharmacy must be a pharmacy in this care group",
    statusCode: 400,
  },
  "timelineEntryService:medicationNotInGroup": {
    message: "That medication isn't in this care group",
    statusCode: 400,
  },
  "timelineEntryService:systemWrittenKind": {
    message: "Medication changes are written with the medication, not by hand",
    statusCode: 403,
  },
  "noteDocumentService:medicationNotFound": {
    message: "That medication is gone. It may have been deleted.",
    statusCode: 404,
  },
  "publicForms:invalid": {
    message: "Check the form and try again",
    statusCode: 400,
  },
  "timelineEntryService:rescheduledToNotInGroup": {
    message: "A rescheduled event must point at another event in this care group",
    statusCode: 400,
  },
  "careRecipientService:invalid": {
    message: "Check the form and try again",
    statusCode: 400,
  },
  "careRecipientService:notFound": {
    message: "Care recipient not found",
    statusCode: 404,
  },
  "careRecipientDetailsService:invalid": {
    message: "Check the form and try again",
    statusCode: 400,
  },
  "careRecipientDetailsService:notAllowed": {
    message: "Only owners, admins and caretakers can see or change these details",
    statusCode: 403,
  },
  "careRecipientDetailsService:managersOnly": {
    message: "Only owners and admins can change emergency contacts",
    statusCode: 403,
  },
  "emergencyContactService:invalid": {
    message: "Check the emergency contacts and try again",
    statusCode: 400,
  },
  "emergencyContactService:notAllowed": {
    message: "Only owners and admins can change emergency contacts",
    statusCode: 403,
  },
  "emergencyContactService:noPhone": {
    message: "Only members who share a phone number with the group can be emergency contacts",
    statusCode: 409,
  },
  "userContactService:invalid": {
    message: "Check the form and try again",
    statusCode: 400,
  },
  "memberSharingService:invalid": {
    message: "Check the form and try again",
    statusCode: 400,
  },
  "memberSharingService:notFound": {
    message: "Care group not found",
    statusCode: 404,
  },
  "searchService:notFound": {
    message: "Care group not found",
    statusCode: 404,
  },
  "searchService:badCursor": {
    message: "Invalid page cursor",
    statusCode: 400,
  },
  "searchService:query": {
    message: "Failed to search",
  },
  "carePeriodService:invalid": {
    message: "The care period is invalid",
    statusCode: 400,
  },
  "carePeriodService:notFound": {
    message: "Care period not found",
    statusCode: 404,
  },
  "carePeriodService:immutable": {
    message: "A care period's group and recipient can't change",
    statusCode: 400,
  },
  "carePeriodService:noRecipient": {
    message: "This care group has no care recipient yet",
    statusCode: 409,
  },
  "carePeriodService:recipientNotInGroup": {
    message: "That care recipient isn't in this care group",
    statusCode: 400,
  },
  "carePeriodService:badPlace": {
    message: "The place must be a provider in this care group",
    statusCode: 400,
  },
  "carePeriodService:futureStart": {
    message: "A care period can't start in the future",
    statusCode: 400,
  },
  "noteDocumentService:carePeriodNotFound": {
    message: "That care period is gone. It may have been deleted.",
    statusCode: 404,
  },
  "adminAuditService:invalid": {
    message: "The audit entry is invalid",
    statusCode: 400,
  },
  "staff:notAllowed": {
    message: "Your staff role doesn't allow that",
    statusCode: 403,
  },
  "adminGrant:unknownAddress": {
    message: "No account has that email address",
    statusCode: 404,
  },
  "adminGrant:invalidRole": {
    message: "The role must be admin or support",
    statusCode: 400,
  },
  "accountAdmin:invalid": {
    message: "Check the form and try again",
    statusCode: 400,
  },
  "accountAdmin:notFound": {
    message: "No account has that id",
    statusCode: 404,
  },
  "accountAdmin:sessionNotFound": {
    message: "That session has already ended",
    statusCode: 404,
  },
  "accountAdmin:alreadyVerified": {
    message: "That address is already confirmed",
    statusCode: 409,
  },
  "accountAdmin:query": {
    message: "Failed to read the account",
  },
  // The four below are staffRules' STAFF_REFUSAL_MESSAGES (a test keeps
  // them equal). 409, not 403: the page shows the message as it is.
  "accountAdmin:self": {
    message: "You can't do that to your own account.",
    statusCode: 409,
  },
  "accountAdmin:lastAdmin": {
    message: "There must always be at least one admin.",
    statusCode: 409,
  },
  "accountAdmin:unknownRole": {
    message: "That isn't a staff role.",
    statusCode: 400,
  },
  "accountAdmin:unchanged": {
    message: "They already have that role.",
    statusCode: 409,
  },
  "accountAdmin:alreadyDisabled": {
    message: "That account is already disabled",
    statusCode: 409,
  },
  "accountAdmin:notDisabled": {
    message: "That account isn't disabled",
    statusCode: 409,
  },
  "accountAdmin:disabled": {
    message: "That account is disabled. Re-enable it first.",
    statusCode: 409,
  },
  "groupAdminService:notFound": {
    message: "Care group not found",
    statusCode: 404,
  },
  "groupAdminService:notMember": {
    message: "That person isn't in this care group",
    statusCode: 404,
  },
  "groupAdminService:invalid": {
    message: "Check the form and try again",
    statusCode: 400,
  },
  "groupAdminService:unchanged": {
    message: "They already have that role.",
    statusCode: 409,
  },
  "settings:signupClosed": {
    message: "This isn't available right now. Try again later.",
    statusCode: 403,
  },
  "settings:unknownKey": {
    message: "There's no such setting",
    statusCode: 404,
  },
  "settings:invalid": {
    message: "Check the setting's value",
    statusCode: 400,
  },
  "settings:noReason": {
    message: "Say why you're changing it",
    statusCode: 400,
  },
  "careGroupInviteService:linkTooLong": {
    message: "That's longer than invite links may work",
    statusCode: 400,
  },
  "careGroupInviteService:tooManyUses": {
    message: "That's more uses than invite links may have",
    statusCode: 400,
  },
  "medicationService:badPass": {
    message: "A medication's passes must be passes in this care group",
    statusCode: 400,
  },
  "medicationPassService:invalid": {
    message: "The pass is invalid",
    statusCode: 400,
  },
  "medicationPassService:notFound": {
    message: "Pass not found",
    statusCode: 404,
  },
  "medicationPassService:immutable": {
    message: "A pass's group and recipient can't change",
    statusCode: 400,
  },
  "medicationPassService:nameTaken": {
    message: "Another pass already has that name",
    statusCode: 409,
  },
  "medicationPassService:tooMany": {
    message: "This care group already has as many passes as it can",
    statusCode: 409,
  },
  "recipientAllergyService:invalid": {
    message: "The allergy is invalid",
    statusCode: 400,
  },
  "recipientAllergyService:notFound": {
    message: "Allergy not found",
    statusCode: 404,
  },
  "recipientAllergyService:immutable": {
    message: "An allergy's group and recipient can't change",
    statusCode: 400,
  },
  "recipientAllergyService:hasAllergies": {
    message: "Remove the allergies on file before recording No known allergies",
    statusCode: 409,
  },
  "recipientAllergyService:invalidNoKnown": {
    message: "No known allergies needs a time, or none to clear it",
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
