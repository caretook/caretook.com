import type { LegalAcceptance } from "../../db";

import * as baseModel from "../base";

export const schemaName = "legalAcceptanceSchema";

export const dbToModel = (row: LegalAcceptance) => row;

const base = baseModel.getFunctions({ schemaName, dbToModel });

// Append-only: created by legalAcceptanceService.record (as the system), never changed.
export const { create, get, getById, list } = base;
