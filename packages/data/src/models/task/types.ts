import type { dbToModel } from "./taskModel";

export type TaskModel = ReturnType<typeof dbToModel>;
