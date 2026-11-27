import type { TimelineEntryProvider } from "../../db";

import * as baseModel from "../base";

export const schemaName = "timelineEntryProviderSchema";

export const dbToModel = (row: TimelineEntryProvider) => row;

// Links are created and removed, never changed. Write through
// entryProviderService, which checks the entry and the provider.
export const { create, get, getById, list, remove } = baseModel.getFunctions({ schemaName, dbToModel });

/** Many links in one INSERT (a series' visits: B-755). */
export const createMany = baseModel.createMany({ schemaName, dbToModel });
