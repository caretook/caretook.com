import type { MedicationCondition } from "../../db";

import * as baseModel from "../base";

export const schemaName = "medicationConditionSchema";

export const dbToModel = (row: MedicationCondition) => row;

// Links are created and removed, never changed. Write through
// medicationConditionService, which checks the medication and the condition.
export const { create, get, getById, list, remove } = baseModel.getFunctions({ schemaName, dbToModel });
