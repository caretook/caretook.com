export const PROFILES_ERRORS = {
  "careRecipientService:invalidTimeZone": {
    message: "The care recipient needs a valid time zone",
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
  "recipientConditionService:invalid": {
    message: "The condition is invalid",
    statusCode: 400,
  },
  "recipientConditionService:notFound": {
    message: "Condition not found",
    statusCode: 404,
  },
  "recipientConditionService:immutable": {
    message: "A condition's group and recipient can't change",
    statusCode: 400,
  },
  "recipientConditionService:hasConditions": {
    message: "Remove the conditions on file before recording No known conditions",
    statusCode: 409,
  },
  "recipientConditionService:invalidNoKnown": {
    message: "No known conditions needs a time, or none to clear it",
    statusCode: 400,
  },
  "recipientConditionModel:remove": {
    message: "Failed to delete the condition",
  },
  "medicationConditionService:invalid": {
    message: "The medication's condition link is invalid",
    statusCode: 400,
  },
  "medicationConditionService:medicationNotFound": {
    message: "That medication is gone. It may have been deleted.",
    statusCode: 404,
  },
  "medicationConditionService:conditionNotFound": {
    message: "That condition is gone. It may have been deleted.",
    statusCode: 404,
  },
  "medicationConditionService:immutable": {
    message: "A link's medication and condition must be in its care group",
    statusCode: 400,
  },
  "recipientConditionService:badProvider": {
    message: "Choose a provider in this care group",
    statusCode: 400,
  },
  "recipientConditionService:providerNotFound": {
    message: "That provider is gone. It may have been deleted.",
    statusCode: 404,
  },
  "recipientConditionService:managerNotInGroup": {
    message: "A condition and the providers who manage it must be in one care group",
    statusCode: 400,
  },
} as const;
