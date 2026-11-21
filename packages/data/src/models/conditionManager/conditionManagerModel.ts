import type { ConditionManager } from "../../db";

import * as baseModel from "../base";

export const schemaName = "conditionManagerSchema";

export const dbToModel = (row: ConditionManager) => row;

// Links are created and removed, never changed. Write through
// recipientConditionService, which checks the condition and the provider.
export const { create, get, getById, list, remove } = baseModel.getFunctions({ schemaName, dbToModel });
