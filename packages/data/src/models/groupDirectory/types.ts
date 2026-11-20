import type { members, search } from "./groupDirectoryModel";
import type { AppError } from "../../errors";

export type GroupDirectoryRow = Exclude<Awaited<ReturnType<typeof search>>, AppError>["data"][number];
export type GroupDirectoryMember = Exclude<Awaited<ReturnType<typeof members>>, AppError>[number];
export type { GroupDirectoryFilter } from "./groupDirectoryModel";
