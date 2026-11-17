import type { ServiceContext } from "./types";

import { userModel } from "../models";
import { getService } from "./baseService";

export const serviceName = "user";
export const schemaName = userModel.schemaName;

export const { create, get, getById, list, remove, update, upsert } = getService(userModel);

export const getByEmail = (ctx: ServiceContext, email: string) => userModel.getByEmail(email, ctx);
