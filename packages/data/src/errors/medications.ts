export const MEDICATIONS_ERRORS = {
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
  "medicationService:badPass": {
    message: "A medication's med times must be med times in this care group",
    statusCode: 400,
  },
  "medicationPassService:invalid": {
    message: "The med time is invalid",
    statusCode: 400,
  },
  "medicationPassService:notFound": {
    message: "Med time not found",
    statusCode: 404,
  },
  "medicationPassService:immutable": {
    message: "A med time's group and recipient can't change",
    statusCode: 400,
  },
  "medicationPassService:nameTaken": {
    message: "Another med time already has that name",
    statusCode: 409,
  },
  "medicationPassService:tooMany": {
    message: "This care group already has as many med times as it can",
    statusCode: 409,
  },
} as const;
