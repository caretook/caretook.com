import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "../core/columns";

import { pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { z } from "zod";
import { careGroupSchema } from "../care-groups/careGroup";
import { audits, timestamps } from "../core/columns";
import { SYMPTOM_NAME_MAX, symptomKey, symptomName, symptomTypeId } from "./symptomCatalog";

// A care group's symptom catalog (symptom-catalog PRD): one row per symptom
// the group logs, the defaults (`DEFAULT_SYMPTOMS`) copied in when the group
// is made. `name` is the first spelling; `name_key` folds case and spaces
// (`symptomKey`), one row per key. The id is derived from the group and the
// key (`symptomTypeId`), so devices adding the same name offline write one
// row. Rows are never renamed or removed in this topic, so there's no soft
// delete; deleting the group removes them.

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
    ...timestamps,
    ...audits,
  },
  (t) => [
    unique("symptom_type_group_id_name_key_unique").on(t.groupId, t.nameKey),
    // For entries' composite foreign key (group, type): never another group's type.
    unique("symptom_type_group_id_id_unique").on(t.groupId, t.id),
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
