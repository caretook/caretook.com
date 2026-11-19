import type { dbToModel, searchRowToEntry } from "./adminAuditLogModel";

export type AdminAuditLogModel = ReturnType<typeof dbToModel>;
export type AdminAuditEntry = ReturnType<typeof searchRowToEntry>;
