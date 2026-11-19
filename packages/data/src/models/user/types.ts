import type { dbToModel } from "./userModel";

export type UserModel = ReturnType<typeof dbToModel>;
/** A user row read in full (yourself, staff or the system). */
export type WholeUserModel = Extract<UserModel, { publicOnly: false }>;
