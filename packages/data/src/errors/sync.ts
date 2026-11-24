// The sync area's errors: what `sync.upload` answers a device's op itself,
// before or instead of a service.
export const SYNC_ERRORS = {
  "sync:readOnlyTable": {
    message: "Devices can't write to this table",
    statusCode: 403,
  },
  "sync:unknownColumn": {
    message: "Devices can't write this column",
    statusCode: 400,
  },
  // A NUL character anywhere in an op's data: Postgres can't store it in text or jsonb.
  "sync:invalid": {
    message: "This change has a character that can't be saved",
    statusCode: 400,
  },
  // The server couldn't process this one op (an `upload` result, not a response).
  "sync:failed": {
    message: "The server couldn't save this change",
  },
} as const;
