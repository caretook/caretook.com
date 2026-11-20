export const ADMIN_ERRORS = {
  "staffGroupService:staffOnly": {
    message: "Only Caretook staff can do that",
    statusCode: 403,
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
  "dbAccess:unknownAddress": {
    message: "No account has that email address",
    statusCode: 404,
  },
  "dbAccess:notStaff": {
    message: "Only an enabled staff account can get database access",
    statusCode: 403,
  },
  "dbAccess:invalidHours": {
    message: "Database access lasts 1 to 24 hours",
    statusCode: 400,
  },
  "dbAccess:failed": {
    message: "Failed to change database access",
  },
} as const;
