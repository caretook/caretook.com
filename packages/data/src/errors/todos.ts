export const TODOS_ERRORS = {
  "todoService:invalid": {
    message: "The todo is invalid",
    statusCode: 400,
  },
  "todoService:notFound": {
    message: "Todo not found",
    statusCode: 404,
  },
  "todoService:immutable": {
    message: "A todo's group and recipient can't change",
    statusCode: 400,
  },
  "todoService:noRecipient": {
    message: "This care group has no care recipient yet",
    statusCode: 409,
  },
  "todoService:recipientNotInGroup": {
    message: "That care recipient isn't in this care group",
    statusCode: 400,
  },
  "todoService:assigneeNotMember": {
    message: "The assignee must be a member of this care group",
    statusCode: 400,
  },
  "todoService:badLink": {
    message: "A linked provider, medication or appointment must be in this care group",
    statusCode: 400,
  },
  "todoService:viewerCompletionOnly": {
    message: "Viewers can only complete or reopen todos assigned to them",
    statusCode: 403,
  },
} as const;
