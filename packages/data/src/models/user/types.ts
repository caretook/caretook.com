import type { dbToModel } from "./userModel";

export type UserModel = ReturnType<typeof dbToModel>;
