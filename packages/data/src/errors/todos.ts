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
    message: "A linked provider, medication or event must be in this care group",
    statusCode: 400,
  },
  "todoService:notAnOccurrence": {
    message: "That isn't a repeating todo's next occurrence",
    statusCode: 400,
  },
  "todoService:completionOnly": {
    message: "You can only complete or reopen todos assigned to you",
    statusCode: 403,
  },
  "todoService:badParent": {
    message:
      "A subtask's parent must be a live todo in this care group that doesn't repeat, at most 3 levels deep",
    statusCode: 400,
  },
  "todoService:repeatWithSubtasks": {
    message: "A subtask, or a todo with subtasks, can't repeat",
    statusCode: 400,
  },
  "entryTodoService:invalid": {
    message: "The todo link is invalid",
    statusCode: 400,
  },
  "entryTodoService:entryNotFound": {
    message: "That entry is gone. It may have been deleted.",
    statusCode: 404,
  },
  "entryTodoService:todoNotFound": {
    message: "That todo is gone. It may have been deleted.",
    statusCode: 404,
  },
  "entryTodoService:immutable": {
    message: "A link's entry and todo must be in its care group",
    statusCode: 400,
  },
} as const;
