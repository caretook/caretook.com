import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "../core/columns";
import type { TagColor } from "./tagRules";

import { sql } from "drizzle-orm";
import { check, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { z } from "zod";
import { careGroupSchema } from "../care-groups/careGroup";
import { audits, timestamps } from "../core/columns";
import { TAG_COLORS, isTagIdFor, tagColorZSchema, tagKey, tagNameZSchema } from "./tagRules";

// A care group's shared tag list (tags PRD): one row per tag. `name` is how
// it's shown; `name_key` folds case and spaces (`tagKey`), one tag per key
// in a group. `color` is a palette id (`TAG_COLORS`, the avatar colors), null
// for the neutral chip. The id is derived from the group, the key and a counter
// (`tagId`), so two devices adding the same name offline write one row. A
// tag is hard-deleted (its links cascade); deleting the group removes it.

export const tagSchema = pgTable(
  "tag",
  {
    // Always given: tagId(groupId, nameKey, counter).
    id: uuid("id").primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => careGroupSchema.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    nameKey: text("name_key").notNull(),
    // A palette id (tags-2); null renders as the neutral chip.
    color: text("color", { enum: TAG_COLORS }),
    ...timestamps,
    ...audits,
  },
  (t) => [
    unique("tag_group_id_name_key_unique").on(t.groupId, t.nameKey),
    // For links' composite foreign key (group, tag): never another group's tag.
    unique("tag_group_id_id_unique").on(t.groupId, t.id),
    // `text({ enum })` only narrows the TS type; this enforces it in the database.
    check("tag_color_check", sql`${t.color} IN (${sql.raw(TAG_COLORS.map((c) => `'${c}'`).join(", "))})`),
  ],
);

export type TagSchema = typeof tagSchema;
export type TagSelect = InferSelectModel<TagSchema>;
export type TagInsert = Omit<InferInsertModel<TagSchema>, ProtectedField>;
export type Tag = TagSelect;

/** The row a tag named `name` in `groupId` writes under `id`: the name as stored, its key and its color. */
export const tagRow = (id: string, groupId: string, name: string, color: TagColor | null = null) => ({
  id: id.toLowerCase(),
  groupId,
  name: tagNameZSchema.parse(name),
  nameKey: tagKey(name),
  color,
});

/**
 * A new tag (a device's `tag` upload, or a server caller): the group and the
 * name. The id, when given, must be one derived from them (`tagId`, any
 * counter), so a device can't hold a tag under an id no device would write.
 * Without one, the service takes the next free counter. The color, when
 * given, is a palette id; without one (or null), the service picks one no
 * group tag has (`pickTagColor`).
 */
export const tagCreateZSchema = z
  .strictObject({
    id: z.uuid().optional(),
    groupId: z.uuid(),
    name: tagNameZSchema,
    color: tagColorZSchema.nullish(),
  })
  .refine((v) => !v.id || isTagIdFor(v.groupId, v.name, v.id), {
    path: ["id"],
    error: "A tag's id comes from its group and name",
  });
export type TagCreateInput = z.input<typeof tagCreateZSchema>;
