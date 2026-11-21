import type { ReminderOverride } from "../../db";

import * as baseModel from "../base";

export const schemaName = "reminderOverrideSchema";

export const dbToModel = (row: ReminderOverride) => row;

// The "Remind me" sheet's rows (slice 8); the member's own only.
export const { create, get, getById, list, remove, update, upsert } = baseModel.getFunctions({
  schemaName,
  dbToModel,
});
