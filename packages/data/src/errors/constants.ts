export const DB_ERRORS = {
  "db:missingUrl": {
    message: "DATABASE_URL is not set",
  },
  "db:connect": {
    message: "Failed to connect to the database",
  },
  "db:transaction": {
    message: "Transaction failed",
  },
  "db:migrate": {
    message: "Failed to migrate the database",
  },
  "db:seed": {
    message: "Failed to seed the database",
  },
  "db:seed:production": {
    message: "Refusing to seed a production database",
  },
  "db:clear": {
    message: "Failed to clear the database",
  },
  "db:clear:notLocal": {
    message: "Refusing to clear a database that isn't on localhost",
  },
} as const;

export const MODEL_ERRORS = {
  "baseModel:create": {
    message: "Failed to create",
  },
  "baseModel:create:nothingCreated": {
    message: "Nothing created",
  },
  "baseModel:get": {
    message: "Failed to get. Do you have permission?",
  },
  "baseModel:list": {
    message: "Failed to list. Do you have permission to access the resources you requested?",
  },
  "baseModel:noFilter": {
    message: "A filter is required for this action",
    statusCode: 400,
  },
  "baseModel:filter:unknownField": {
    message: "Unknown filter field",
    statusCode: 400,
  },
  "baseModel:filter:unknownOperator": {
    message: "Unknown filter operator",
    statusCode: 400,
  },
  "baseModel:filter:emptyGroup": {
    message: "Filter groups (and/or) need at least one condition",
    statusCode: 400,
  },
  "baseModel:orderBy:unknownField": {
    message: "Unknown orderBy field",
    statusCode: 400,
  },
  "baseModel:remove": {
    message: "Error deleting. Do you have permission?",
  },
  "baseModel:remove:nothingRemoved": {
    message: "Nothing deleted. Do you have permission?",
  },
  "baseModel:update": {
    message: "Failed to update. Do you have permission?",
  },
  "baseModel:update:nothingUpdated": {
    message: "Nothing updated. Do you have permission?",
  },
  "baseModel:upsert": {
    message: "Failed to upsert. Do you have permission?",
  },
  "userModel:notFound": {
    message: "User not found",
    statusCode: 404,
  },
} as const;

export const SERVICE_ERRORS = {
  "userService:notFound": {
    message: "No user found",
    statusCode: 404,
  },
} as const;

export const PERMISSION_ERRORS = {
  "permissions:unauthorized": {
    message: "Unauthorized",
    statusCode: 403,
  },
  "permissions:unauthenticated": {
    message: "Unauthenticated",
    statusCode: 401,
  },
  "permissions:fieldUnauthorized": {
    message: "You do not have permission to set one or more fields",
    statusCode: 403,
  },
} as const;

export const ERRORS = {
  error: {
    message: "An error occurred",
  },
  ...DB_ERRORS,
  ...MODEL_ERRORS,
  ...SERVICE_ERRORS,
  ...PERMISSION_ERRORS,
} as const;

export const ERROR_KEYS = Object.keys(ERRORS) as (keyof typeof ERRORS)[];
