import type { SymptomTypeAddInput, Tx } from "../db";
import type { AppError } from "../errors";
import type { ServiceContext } from "./types";

import { and, asc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { isLoggerRole, isWriterRole, SYSTEM_USER } from "../constants";
import { dbMayFail, getDb, txOrDb, withTransaction } from "../db";
import {
  careGroupSchema,
  DEFAULT_SYMPTOMS,
  SYMPTOM_NAME_MAX,
  symptomKey,
  symptomName,
  symptomTypeAddZSchema,
  symptomTypeNameZSchema,
  symptomTypeRow,
  symptomTypeSchema,
  timelineEntrySchema,
} from "../db/schema";
import { isError, newError } from "../errors";
import { careGroupMemberModel, symptomTypeModel } from "../models";
import { isSystemUser, rejectError } from "../permissions";

// A care group's symptom catalog (symptom-catalog PRD). Write through here:
// the id and the key are derived from the group and the name
// (`symptomTypeRow`), so adding a name the group already has, in any case
// or spacing, returns that row. Rows are never renamed or removed; a writer
// archives one and brings it back (`archive`, `unarchive`: symptom-catalog-2).
//
// Three ways in: `addDefaults` when a group is made, `ensure` when someone
// logs a name, and `backfill` (the migrate command and the seed's last step)
// for groups and entries from before the catalog.

export const serviceName = "symptomType";
export const schemaName = symptomTypeModel.schemaName;

const invalid = (issues: { path: string; message: string }[]) =>
  newError({ code: "symptomTypeService:invalid", meta: { issues } });

const audits = { createdBy: SYSTEM_USER.id, updatedBy: SYSTEM_USER.id };

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** A group's catalog, A to Z. Any member; nobody else sees a row. */
export const list = (ctx: ServiceContext, { groupId }: { groupId: string }) =>
  symptomTypeModel.list({ ...ctx, filter: { groupId: { type: "eq", value: groupId } } });

export const getById = (ctx: ServiceContext, id: string) => symptomTypeModel.getById(id, ctx);

/** The group's row for `name` (any case or spacing), or null. */
export const getByName = (ctx: ServiceContext, groupId: string, name: string) =>
  symptomTypeModel.get({
    ...ctx,
    filter: { groupId: { type: "eq", value: groupId }, nameKey: { type: "eq", value: symptomKey(name) } },
  });

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * The group's row for `name`, added when it has none: as the actor (who must
 * be able to log: `LOGGERS`), inside the caller's transaction when there is
 * one. Idempotent: any case or spacing of a name returns its one row, and two
 * transactions adding the same name at once wait for each other (an
 * advisory lock on the derived id) instead of colliding.
 */
export const ensure = (ctx: ServiceContext, groupId: string, name: string) =>
  withTransaction(async (tx) => {
    const parsed = symptomTypeNameZSchema.safeParse(name);
    if (!parsed.success)
      return invalid(parsed.error.issues.map(({ message }) => ({ path: "name", message })));
    const row = symptomTypeRow(groupId, parsed.data);

    const lock = await dbMayFail(
      () => tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${row.id}, 0))`),
      "baseModel:create",
      { schemaName },
    );
    if (isError(lock)) return lock;

    const existing = await getByName({ ...ctx, tx }, groupId, row.name);
    if (isError(existing) || existing) return existing;
    return symptomTypeModel.create({ ...ctx, tx, data: row });
  }, ctx);

/**
 * A device's new name (its `symptom_type` PUT, symptom-catalog slice 3): the
 * group's row for `name`, added when it has none, as `ensure` does. Only
 * someone who may log in the group gets an answer, even for a name the group
 * already has: a viewer's or Easy viewer's upload is refused, never applied.
 * The device's id, when given, must be the one derived from the group and name.
 */
export const add = (ctx: ServiceContext, input: SymptomTypeAddInput) =>
  withTransaction(async (tx) => {
    const parsed = symptomTypeAddZSchema.safeParse(input);
    if (!parsed.success)
      return invalid(parsed.error.issues.map(({ path, message }) => ({ path: path.join("."), message })));
    const { groupId, name } = parsed.data;
    if (!ctx.authUser) return rejectError(null);
    if (!isSystemUser(ctx.authUser)) {
      const role = await careGroupMemberModel.getRole(groupId, ctx.authUser.id, { tx });
      if (isError(role)) return role;
      if (!isLoggerRole(role)) return rejectError(ctx.authUser);
    }
    return ensure({ ...ctx, tx }, groupId, name);
  }, ctx);

/**
 * Archive one of the group's rows (`archived: true`) or bring it back, as a
 * writer (`WRITERS`): online only (oRPC), never uploaded. Idempotent: a
 * repeat returns the row unchanged. Refuses another group's row or a missing
 * one (`notFound`) and a tombstone (`merged`). Records the actor in
 * `updated_by`.
 */
const setArchived = (
  ctx: ServiceContext,
  { groupId, id }: { groupId: string; id: string },
  archived: boolean,
) =>
  withTransaction(async (tx) => {
    if (!ctx.authUser) return rejectError(null);
    if (!isSystemUser(ctx.authUser)) {
      const role = await careGroupMemberModel.getRole(groupId, ctx.authUser.id, { tx });
      if (isError(role)) return role;
      if (!isWriterRole(role)) return rejectError(ctx.authUser);
    }
    const row = await getById({ ...ctx, tx }, id);
    if (isError(row)) return row;
    if (!row || row.groupId !== groupId) return newError({ code: "symptomTypeService:notFound" });
    if (row.replacedById) return newError({ code: "symptomTypeService:merged" });
    if (!!row.archivedAt === archived) return row;

    const changed = await symptomTypeModel.setArchived(
      { groupId, id, archived },
      { actorId: ctx.authUser.id, tx },
    );
    if (isError(changed)) return changed;
    return getById({ ...ctx, tx }, id);
  }, ctx);

/** Archive a symptom: it leaves suggestions and pickers; its entries stay. See `setArchived`. */
export const archive = (ctx: ServiceContext, input: { groupId: string; id: string }) =>
  setArchived(ctx, input, true);

/** Bring an archived symptom back. See `setArchived`. */
export const unarchive = (ctx: ServiceContext, input: { groupId: string; id: string }) =>
  setArchived(ctx, input, false);

/** Insert catalog rows as the system, leaving any the group already has. Returns how many were added. */
const insertRows = async (tx: Tx | undefined, rows: ReturnType<typeof symptomTypeRow>[]) => {
  if (!rows.length) return 0;
  const added = await dbMayFail(
    () =>
      txOrDb(tx)
        .insert(symptomTypeSchema)
        .values(rows.map((r) => ({ ...r, ...audits })))
        .onConflictDoNothing()
        .returning({ id: symptomTypeSchema.id }),
    "symptomTypeService:backfill",
  );
  return isError(added) ? added : added.length;
};

/**
 * A new care group's catalog (`DEFAULT_SYMPTOMS`), as the system, inside the
 * caller's transaction. Every way of creating a group calls this. Returns
 * null, or the error.
 */
export const addDefaults = async (tx: Tx, groupId: string) => {
  const added = await insertRows(
    tx,
    DEFAULT_SYMPTOMS.map((name) => symptomTypeRow(groupId, name)),
  );
  return isError(added) ? added : null;
};

/**
 * Point entries at their types, only where the pointer is still null. Raw
 * SQL, so Drizzle's `$onUpdate` doesn't bump `updated_at`, and `updated_by`
 * is never named: an edit made on a device since still wins, and
 * `details.name` is left as written. Returns how many were filled.
 */
const fillPointers = async (pointers: { entryId: string; typeId: string }[]) => {
  if (!pointers.length) return 0;
  const values = sql.join(
    pointers.map((p) => sql`(${p.entryId}::uuid, ${p.typeId}::uuid)`),
    sql`, `,
  );
  const filled = await dbMayFail(
    () =>
      getDb().execute(sql`
        UPDATE timeline_entry AS e SET symptom_type_id = v.type_id
        FROM (VALUES ${values}) AS v(id, type_id)
        WHERE e.id = v.id AND e.symptom_type_id IS NULL`),
    "symptomTypeService:backfill",
  );
  return isError(filled) ? filled : (filled.rowCount ?? 0);
};

/** Rows per batch: groups for the defaults, entries for their names. */
const BATCH = 500;

export type BackfillSummary = {
  /** Groups looked at. */
  groups: number;
  /** Default rows added (none when every group has them). */
  defaults: number;
  /** Rows added for names found on live symptom entries. */
  history: number;
  /** Live symptom entries given their type (their pointer was null). */
  pointers: number;
  /** Live symptom entries whose name can't be read (missing, empty or too long): left out. */
  unreadable: string[];
};

/**
 * Fill in the catalog of every group made before it, or since its defaults
 * changed: the missing `DEFAULT_SYMPTOMS`, and one row per distinct key
 * among **live** symptom entries' names (the earliest entry's spelling). A
 * soft-deleted entry adds no name. Run by `pnpm datastore:migrate` after the
 * SQL migrations, and as the seed's last step. Each of those entries whose
 * `symptom_type_id` is null then points at its type, with its wording,
 * `updated_at` and `updated_by` as they were. Idempotent: a rerun changes
 * nothing. Writes as the system, in batches.
 */
export const backfill = async () => {
  const db = getDb();
  const summary: BackfillSummary = { groups: 0, defaults: 0, history: 0, pointers: 0, unreadable: [] };

  // Every group's defaults.
  let afterGroup: string | null = null;
  for (;;) {
    const groups = await dbMayFail(
      () =>
        db
          .select({ id: careGroupSchema.id })
          .from(careGroupSchema)
          .where(afterGroup ? gt(careGroupSchema.id, afterGroup) : undefined)
          .orderBy(asc(careGroupSchema.id))
          .limit(BATCH),
      "symptomTypeService:backfill",
    );
    if (isError(groups)) return groups;
    if (!groups.length) break;
    const added = await insertRows(
      undefined,
      groups.flatMap((g) => DEFAULT_SYMPTOMS.map((name) => symptomTypeRow(g.id, name))),
    );
    if (isError(added)) return added;
    summary.groups += groups.length;
    summary.defaults += added;
    afterGroup = groups.at(-1)!.id;
  }

  // Names on live symptom entries, oldest first, so the first spelling wins.
  const e = timelineEntrySchema;
  type Cursor = { createdAt: string; id: string };
  type EntryName = Cursor & { groupId: string; name: unknown; symptomTypeId: string | null };
  let after: Cursor | null = null;
  for (;;) {
    const cursor: Cursor | null = after;
    const entries: EntryName[] | AppError = await dbMayFail(
      (): Promise<EntryName[]> =>
        db
          .select({
            id: e.id,
            groupId: e.groupId,
            createdAt: e.createdAt,
            name: sql<unknown>`${e.details}->'name'`,
            symptomTypeId: e.symptomTypeId,
          })
          .from(e)
          .where(
            and(
              eq(e.kind, "symptom"),
              isNull(e.deletedAt),
              cursor
                ? or(
                    gt(e.createdAt, cursor.createdAt),
                    and(eq(e.createdAt, cursor.createdAt), gt(e.id, cursor.id)),
                  )
                : undefined,
            ),
          )
          .orderBy(asc(e.createdAt), asc(e.id))
          .limit(BATCH),
      "symptomTypeService:backfill",
    );
    if (isError(entries)) return entries;
    if (!entries.length) break;

    const rows = new Map<string, ReturnType<typeof symptomTypeRow>>();
    const pointers: { entryId: string; typeId: string }[] = [];
    for (const entry of entries) {
      const name = typeof entry.name === "string" ? symptomName(entry.name) : "";
      if (!name || name.length > SYMPTOM_NAME_MAX) {
        summary.unreadable.push(entry.id);
        continue;
      }
      const row = symptomTypeRow(entry.groupId, name);
      if (!rows.has(row.id)) rows.set(row.id, row);
      if (!entry.symptomTypeId) pointers.push({ entryId: entry.id, typeId: row.id });
    }
    const added = await insertRows(undefined, [...rows.values()]);
    if (isError(added)) return added;
    summary.history += added;
    const pointed = await fillPointers(pointers);
    if (isError(pointed)) return pointed;
    summary.pointers += pointed;
    after = { createdAt: entries.at(-1)!.createdAt, id: entries.at(-1)!.id };
  }

  return summary;
};
