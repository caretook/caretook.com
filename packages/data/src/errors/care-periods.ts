export const CARE_PERIODS_ERRORS = {
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
} as const;
