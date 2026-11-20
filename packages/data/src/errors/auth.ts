export const AUTH_ERRORS = {
  "userService:notFound": {
    message: "No user found",
    statusCode: 404,
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
  "authKeys:failed": {
    message: "Failed to rotate the JWT signing keys",
  },
} as const;
