import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "../core/columns";

import { sql } from "drizzle-orm";
import { check, foreignKey, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { z } from "zod";
import { careGroupSchema } from "../care-groups/careGroup";
import { audits, timestamps } from "../core/columns";
import { SYMPTOM_NAME_MAX, symptomKey, symptomName, symptomTypeId } from "./symptomCatalog";

// A care group's symptom catalog (symptom-catalog PRD): one row per symptom
// the group logs, the defaults (`DEFAULT_SYMPTOMS`) copied in when the group
// is made. `name` is the first spelling; `name_key` folds case and spaces
// (`symptomKey`), one row per key. The id is derived from the group and the
// key (`symptomTypeId`), so devices adding the same name offline write one
// row. Rows are never renamed or removed, so there's no soft delete;
// deleting the group removes them.
//
// Three states (symptom-catalog-2): active; archived (`archived_at`: hidden
// from suggestions and pickers, its entries kept, a writer can bring it
// back); a tombstone (`replaced_by_id`: merged into another of the group's
// rows, written only by the merge, symptom-catalog-3). Both are set by the
// server (`symptomTypeService.archive`/`unarchive`), never uploaded.

export const symptomTypeSchema = pgTable(
  "symptom_type",
  {
    // Always given: symptomTypeId(groupId, name).
    id: uuid("id").primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => careGroupSchema.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    nameKey: text("name_key").notNull(),
    // When a writer archived it; null while active.
    archivedAt: timestamp("archived_at", { precision: 3, mode: "string", withTimezone: true }),
    // The row this one was merged into (a tombstone); null otherwise.
    replacedById: uuid("replaced_by_id"),
    ...timestamps,
    ...audits,
  },
  (t) => [
    unique("symptom_type_group_id_name_key_unique").on(t.groupId, t.nameKey),
    // For entries' composite foreign key (group, type): never another group's type.
    unique("symptom_type_group_id_id_unique").on(t.groupId, t.id),
    // A tombstone's replacement is another row of the same group.
    foreignKey({
      name: "symptom_type_replaced_by_fk",
      columns: [t.groupId, t.replacedById],
      foreignColumns: [t.groupId, t.id],
    }),
    check(
      "symptom_type_replaced_by_not_self",
      sql`${t.replacedById} IS NULL OR ${t.replacedById} <> ${t.id}`,
    ),
  ],
);

export type SymptomTypeSchema = typeof symptomTypeSchema;
export type SymptomTypeSelect = InferSelectModel<SymptomTypeSchema>;
export type SymptomTypeInsert = Omit<InferInsertModel<SymptomTypeSchema>, ProtectedField>;
export type SymptomType = SymptomTypeSelect;

/** A catalog name: what a symptom entry's name allows, trimmed and with single spaces. */
export const symptomTypeNameZSchema = z
  .string()
  .transform(symptomName)
  .pipe(z.string().min(1, { error: "Enter a symptom" }).max(SYMPTOM_NAME_MAX));

/** The row for `name` in `groupId`: its derived id, the name as stored and its key. */
export const symptomTypeRow = (groupId: string, name: string) => ({
  id: symptomTypeId(groupId, name),
  groupId,
  name: symptomName(name),
  nameKey: symptomKey(name),
});

/**
 * A device's new catalog row (its `symptom_type` upload): the group and the
 * name; the id, when given, must be the one derived from them, so a device
 * can't hold a row under an id the server would never write.
 */
export const symptomTypeAddZSchema = z
  .strictObject({
    id: z.uuid().optional(),
    groupId: z.uuid(),
    name: symptomTypeNameZSchema,
  })
  .refine((v) => !v.id || v.id.toLowerCase() === symptomTypeId(v.groupId, v.name), {
    path: ["id"],
    error: "The id must be the one derived from the group and the name",
  });
export type SymptomTypeAddInput = z.input<typeof symptomTypeAddZSchema>;
