export const TIMELINE_ERRORS = {
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
  "timelineEntryService:duplicateRecord": {
    message: "Couldn't record a duplicate dose upload",
    statusCode: 500,
  },
  "timelineEntryService:immutable": {
    message: "An entry's group, recipient and kind can't change",
    statusCode: 400,
  },
  "timelineEntryService:recipientNotInGroup": {
    message: "That care recipient isn't in this care group",
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
  "timelineEntryService:loggerOnly": {
    message: "This role can only log notes, events, symptoms, vitals and doses",
    statusCode: 403,
  },
  "timelineEntryService:rescheduledToNotInGroup": {
    message: "A rescheduled event must point at another event in this care group",
    statusCode: 400,
  },
  "symptomTypeService:invalid": {
    message: "The symptom name is invalid",
    statusCode: 400,
  },
  "symptomTypeService:backfill": {
    message: "Couldn't fill in the symptom catalog",
    statusCode: 500,
  },
  "symptomTypeService:notFound": {
    message: "That symptom isn't in this care group's list",
    statusCode: 404,
  },
  "symptomTypeService:merged": {
    message: "That symptom was merged into another and can't be archived or brought back",
    statusCode: 409,
  },
} as const;
