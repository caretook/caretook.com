import type { TimelineEntryTodo } from "../../db";

import * as baseModel from "../base";

export const schemaName = "timelineEntryTodoSchema";

export const dbToModel = (row: TimelineEntryTodo) => row;

// Links are created and removed, never changed. Write through
// entryTodoService, which checks the entry and the todo.
export const { create, get, getById, list, remove } = baseModel.getFunctions({ schemaName, dbToModel });
