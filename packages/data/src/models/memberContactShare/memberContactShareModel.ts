import type { MemberContactShare } from "../../db";

import * as baseModel from "../base";

export const schemaName = "memberContactShareSchema";

export const dbToModel = (row: MemberContactShare) => row;

export const { create, get, getById, list, remove, update, upsert } = baseModel.getFunctions({
  schemaName,
  dbToModel,
});
