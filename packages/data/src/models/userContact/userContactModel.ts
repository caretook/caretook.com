import type { UserContact } from "../../db";

import * as baseModel from "../base";

export const schemaName = "userContactSchema";

export const dbToModel = (row: UserContact) => row;

export const { create, get, getById, list, remove, update, upsert } = baseModel.getFunctions({
  schemaName,
  dbToModel,
});
