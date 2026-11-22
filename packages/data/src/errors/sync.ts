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
} as const;
