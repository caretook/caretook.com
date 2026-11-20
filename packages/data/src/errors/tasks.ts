export const TASKS_ERRORS = {
  "taskService:invalid": {
    message: "The task is invalid",
    statusCode: 400,
  },
  "taskService:notFound": {
    message: "Task not found",
    statusCode: 404,
  },
  "taskService:immutable": {
    message: "A task's group and recipient can't change",
    statusCode: 400,
  },
  "taskService:noRecipient": {
    message: "This care group has no care recipient yet",
    statusCode: 409,
  },
  "taskService:recipientNotInGroup": {
    message: "That care recipient isn't in this care group",
    statusCode: 400,
  },
  "taskService:assigneeNotMember": {
    message: "The assignee must be a member of this care group",
    statusCode: 400,
  },
  "taskService:badLink": {
    message: "A linked provider, medication or appointment must be in this care group",
    statusCode: 400,
  },
  "taskService:viewerCompletionOnly": {
    message: "Viewers can only complete or reopen tasks assigned to them",
    statusCode: 403,
  },
} as const;
