import type { NoteUpdate } from "../../db";

import * as baseModel from "../base";

export const schemaName = "noteUpdateSchema";

export const dbToModel = (row: NoteUpdate) => row;

// Append-only: writes go through noteDocumentService.appendUpdate; only
// compaction (as the system) removes rows.
export const { create, get, getById, list, remove } = baseModel.getFunctions({ schemaName, dbToModel });
