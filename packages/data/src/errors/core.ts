export const CORE_ERRORS = {
  "sync:readOnlyTable": {
    message: "Devices can't write to this table",
    statusCode: 403,
  },
  "rateLimitService:store": {
    message: "Failed to read or write the rate limits",
  },
} as const;
