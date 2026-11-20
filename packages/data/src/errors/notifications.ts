export const NOTIFICATION_SERVICE_ERRORS = {
  "emailSuppression:invalid": {
    message: "Check the suppression's details",
    statusCode: 400,
  },
  "emailSuppression:notFound": {
    message: "That address isn't suppressed",
    statusCode: 404,
  },
  "emailSuppression:query": {
    message: "Failed to read or write the email suppressions",
  },
} as const;
