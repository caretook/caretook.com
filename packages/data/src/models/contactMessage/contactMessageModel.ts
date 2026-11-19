import type { ContactMessage } from "../../db";

import * as baseModel from "../base";

export const schemaName = "contactMessageSchema";

export const dbToModel = (row: ContactMessage) => row;

const base = baseModel.getFunctions({ schemaName, dbToModel });

// Created by the system (contactMessageService.send); staff read and remove them.
export const { create, get, getById, list, remove } = base;
