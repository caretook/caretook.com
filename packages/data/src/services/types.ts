import type { DbSchemaName, Tx } from "../db";
import type {
  QueryCommonArgs,
  QueryCreateArgs,
  QuerySelectArgs,
  QueryUpdateArgs,
} from "../models";
import type { AuthUser } from "../permissions";

/**
 * Per-request context. The caller (an oRPC handler, a server loader, a
 * worker) resolves the acting user and passes it in. Services don't read
 * requests or cookies, so they run the same way in every runtime.
 */
export type ServiceContext = {
  authUser: AuthUser | null;
  tx?: Tx;
};

export type ServiceSelectArgs<K extends DbSchemaName> = Omit<QuerySelectArgs<K>, keyof QueryCommonArgs>;
export type ServiceUpdateArgs<K extends DbSchemaName> = Omit<QueryUpdateArgs<K>, keyof QueryCommonArgs>;
export type ServiceInsert<K extends DbSchemaName> = QueryCreateArgs<K>["data"];
