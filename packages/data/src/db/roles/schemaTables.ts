import type { SchemaTables } from "./syncConfig";

import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import * as schema from "../schema";

/**
 * Every table in the Drizzle schema with its columns, in schema order (the
 * `tables` the sync config's columns resolve against). Generic: a table a
 * later slice adds is here without an edit.
 */
export const schemaTables = (): SchemaTables => {
  const out: Record<string, string[]> = {};
  for (const value of Object.values(schema)) {
    if (!is(value, PgTable)) continue;
    const config = getTableConfig(value);
    if (config.schema && config.schema !== "public") continue;
    out[config.name] = config.columns.map((c) => c.name);
  }
  return out;
};
