import type { CareGroupConsent } from "../../db";

import * as baseModel from "../base";

export const schemaName = "careGroupConsentSchema";

export const dbToModel = (row: CareGroupConsent) => row;

const base = baseModel.getFunctions({ schemaName, dbToModel });

// Append-only: created by careGroupInviteService.accept (as the system), never changed.
export const { create, get, getById, list } = base;
