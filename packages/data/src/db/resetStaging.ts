import type { SeedEnv, SeedRefusal } from "./seeds/guard";

import { like, sql } from "drizzle-orm";
import { getDbConfig } from "../config";
import { isError, newError } from "../errors";
import { dbMayFail, getDb } from "./client";
import { userSchema } from "./schema";
import { seed } from "./seeds";
import { SEEDED_DOMAIN } from "./seeds/accounts";
import { seedRefusal } from "./seeds/guard";

// Reseed staging from scratch (B-449): empty it, then run the fictional seed.
//
// Unlike `clear` (local only), this never drops anything: it deletes rows, as
// the app role can, so the tables, roles, grants and publication stay, and
// PowerSync replicates each delete and devices empty themselves.
//
// What stays: real sign-ins. Every account whose address isn't `@example.com`
// keeps its user row (with its staff role), its accounts and its sessions.
// Everything those accounts made (groups, entries, connector and Google
// links) goes, and the seed then makes each an owner of every seeded group
// (`seeds/realOwners.ts`).

/**
 * Tables the wipe leaves alone: sign-ins (seeded users are deleted from them
 * afterwards), the signing keys, and configuration that isn't care data
 * (staff settings such as the email allowlist, bounced addresses, the OAuth
 * resource). Every other table in the public schema is emptied, so a table a
 * later migration adds is wiped without an edit here.
 */
export const KEPT_TABLES: readonly string[] = [
  "user",
  "account",
  "session",
  "jwks",
  "app_setting",
  "email_suppression",
  "oauth_resource",
];

export type ResetRefusal = SeedRefusal | "db:reset:notStaging";

/**
 * Why the reset must not run here, or null when it may: only with
 * `APP_ENV=staging`, and only when the seed that follows would run (a secret
 * `SEED_USER_PASSWORD`), so a refusal never leaves staging empty.
 */
export const resetRefusal = (env: SeedEnv): ResetRefusal | null =>
  env.APP_ENV?.trim() === "staging" ? seedRefusal(env) : "db:reset:notStaging";

type Reference = { child: string; parent: string };

/**
 * `tables` ordered so each comes before every table it references: deleting
 * in this order never breaks a foreign key. A table's reference to itself is
 * fine (one statement); null when tables reference each other in a cycle.
 */
export const deleteOrder = (tables: string[], references: Reference[]): string[] | null => {
  const left = new Set(tables);
  const order: string[] = [];
  while (left.size) {
    const free = [...left].filter(
      (table) => !references.some((r) => r.parent === table && r.child !== table && left.has(r.child)),
    );
    if (!free.length) return null;
    for (const table of free.sort()) {
      left.delete(table);
      order.push(table);
    }
  }
  return order;
};

const refuse = () => {
  const refusal = resetRefusal({ ...process.env, DATABASE_URL: getDbConfig().url });
  return refusal ? newError({ code: refusal }) : null;
};

/**
 * Empty staging, keeping real sign-ins (above), in one transaction. Returns
 * the tables it emptied and how many seeded users it removed.
 */
export const wipeStaging = async () => {
  const refusal = refuse();
  if (refusal) return refusal;

  return dbMayFail(
    () =>
      getDb().transaction(async (tx) => {
        const { rows: tableRows } = await tx.execute<{ name: string }>(
          sql`SELECT tablename AS name FROM pg_tables WHERE schemaname = 'public'`,
        );
        const { rows: references } = await tx.execute<Reference>(sql`
          SELECT child.relname AS child, parent.relname AS parent
          FROM pg_constraint c
          JOIN pg_class child ON child.oid = c.conrelid
          JOIN pg_class parent ON parent.oid = c.confrelid
          JOIN pg_namespace n ON n.oid = child.relnamespace
          WHERE c.contype = 'f' AND n.nspname = 'public'`);

        const tables = deleteOrder(
          tableRows.map((t) => t.name).filter((name) => !KEPT_TABLES.includes(name)),
          references,
        );
        if (!tables) throw newError({ code: "db:reset:cycle" });
        for (const table of tables) await tx.execute(sql`DELETE FROM ${sql.identifier(table)}`);

        // Their accounts and sessions go with them (ON DELETE CASCADE).
        const users = await tx
          .delete(userSchema)
          .where(like(userSchema.email, `%${SEEDED_DOMAIN}`))
          .returning({ id: userSchema.id });
        return { tables, seededUsers: users.length };
      }),
    "db:reset",
  );
};

/** Wipe staging, then seed it again. Refuses anywhere but staging. */
export const resetStaging = async () => {
  const wiped = await wipeStaging();
  if (isError(wiped)) return wiped;
  console.log(`Emptied ${wiped.tables.length} table(s) and removed ${wiped.seededUsers} seeded user(s)`);
  return seed();
};
