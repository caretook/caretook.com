import { careRecipientModel } from "../models";
import { getService } from "./baseService";

export const serviceName = "careRecipient";
export const schemaName = careRecipientModel.schemaName;

export const { create, get, getById, list, remove, update, upsert } = getService(careRecipientModel);
