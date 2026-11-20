export const LIVE_NOTES_ERRORS = {
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
  "noteDocumentService:providerNotFound": {
    message: "That provider is gone. They may have been deleted.",
    statusCode: 404,
  },
  "noteDocumentService:medicationNotFound": {
    message: "That medication is gone. It may have been deleted.",
    statusCode: 404,
  },
  "noteDocumentService:carePeriodNotFound": {
    message: "That care period is gone. It may have been deleted.",
    statusCode: 404,
  },
  "noteDocumentService:taskNotFound": {
    message: "That task is gone. It may have been deleted.",
    statusCode: 404,
  },
} as const;
