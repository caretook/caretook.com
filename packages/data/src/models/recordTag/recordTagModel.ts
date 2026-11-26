import type { RecordTag } from "../../db";

import * as baseModel from "../base";

export const schemaName = "recordTagSchema";

export const dbToModel = (row: RecordTag) => row;

// Links are created and removed, never changed. Write through
// recordTagService, which checks the tag, the record and the tagging rule.
export const { create, get, getById, list, remove } = baseModel.getFunctions({ schemaName, dbToModel });
