import { sql } from "drizzle-orm";
import { getDbConfig } from "../config";
import { newError } from "../errors";
import { dbMayFail, getDb } from "./client";

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1", "[::1]"];

/** Clearing is only allowed against a local database. */
export const isLocalDatabase = (url = getDbConfig().url) => {
  if (!url) return false;
  try {
    return LOCAL_HOSTS.includes(new URL(url).hostname);
  } catch {
    return false;
  }
};

/**
 * Drop everything: the public schema (tables, types, functions) and
 * drizzle's migration journal. Refuses to run against a non-local database.
 */
export const clear = async () => {
  if (!isLocalDatabase()) return newError({ code: "db:clear:notLocal" });

  return dbMayFail(
    () =>
      getDb().transaction(async (tx) => {
        await tx.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
        await tx.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
        await tx.execute(sql`CREATE SCHEMA public`);
      }),
    "db:clear",
  );
};
