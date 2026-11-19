import type { AccessCodeRedemption } from "../../db";

import * as baseModel from "../base";

export const schemaName = "accessCodeRedemptionSchema";

export const dbToModel = (row: AccessCodeRedemption) => row;

const base = baseModel.getFunctions({ schemaName, dbToModel });

// Append-only: written by accessCodeService.redeem (as the system); staff read them.
export const { create, get, getById, list } = base;
