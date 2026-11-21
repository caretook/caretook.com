export const APPOINTMENTS_ERRORS = {
  "appointmentSeriesService:invalid": {
    message: "The repeating series is invalid",
    statusCode: 400,
  },
  "appointmentSeriesService:notFound": {
    message: "Repeating series not found",
    statusCode: 404,
  },
  "appointmentSeriesService:immutable": {
    message: "A series' group, recipient and kind can't change",
    statusCode: 400,
  },
  "appointmentSeriesService:noRecipient": {
    message: "This care group has no care recipient yet",
    statusCode: 409,
  },
  "appointmentSeriesService:recipientNotInGroup": {
    message: "That care recipient isn't in this care group",
    statusCode: 400,
  },
  "appointmentSeriesService:providerNotInGroup": {
    message: "A series' providers must be in this care group",
    statusCode: 400,
  },
  "timelineEntryService:seriesNotInGroup": {
    message: "A visit must belong to a series of its kind in this care group",
    statusCode: 400,
  },
  "timelineEntryService:pastVisit": {
    message: "A series edit can't change a past visit",
    statusCode: 409,
  },
  "timelineEntryService:seriesDayTaken": {
    message: "This series already has a visit that day",
    statusCode: 409,
  },
} as const;
