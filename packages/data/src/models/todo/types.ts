import type { dbToModel } from "./todoModel";

export type TodoModel = ReturnType<typeof dbToModel>;
