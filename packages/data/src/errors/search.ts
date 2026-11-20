export const SEARCH_ERRORS = {
  "searchService:notFound": {
    message: "Care group not found",
    statusCode: 404,
  },
  "searchService:badCursor": {
    message: "Invalid page cursor",
    statusCode: 400,
  },
  "searchService:query": {
    message: "Failed to search",
  },
} as const;
