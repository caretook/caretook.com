import type { InferInsertModel, InferSelectModel, Table } from "drizzle-orm";
import type { Db } from "./client";
import type * as schema from "./schema";

export type { Db };
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type DbSchema = typeof schema;
export type DbQuery = Db["query"];

/** Export names of every table in the schema, e.g. "userSchema". */
export type DbSchemaName = {
  [K in keyof DbSchema]: DbSchema[K] extends Table ? K : never;
}[keyof DbSchema] &
  keyof DbQuery;

export type DbTable<K extends DbSchemaName> = DbSchema[K];
export type DbSelect<K extends DbSchemaName> = InferSelectModel<DbTable<K>>;
export type DbInsert<K extends DbSchemaName> = InferInsertModel<DbTable<K>>;
export type DbUpdate<K extends DbSchemaName> = Partial<DbInsert<K>>;

export type DbFieldKey<K extends DbSchemaName> = keyof DbSelect<K> & string;
export type DbFieldDataType<
  K extends DbSchemaName,
  F extends DbFieldKey<K>,
> = DbSelect<K>[F];

type FindFirstConfig<K extends DbSchemaName> = NonNullable<
  Parameters<DbQuery[K]["findFirst"]>[0]
>;

/** The `with` option for relational queries on table K. */
export type DbQueryWith<K extends DbSchemaName> = NonNullable<FindFirstConfig<K>["with"]>;
