import type { CareRecipient } from "../../db";

import * as baseModel from "../base";

export const schemaName = "careRecipientSchema";

export const dbToModel = (row: CareRecipient) => ({
  ...row,
  displayName: row.preferredName || row.name,
});

export const { create, get, getById, list, remove, update, upsert } = baseModel.getFunctions({
  schemaName,
  dbToModel,
});
