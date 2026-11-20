import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "../core/columns";
import type { TimelineEntryKind } from "../timeline/timelineEntry";

import { foreignKey, index, pgTable, unique, uuid } from "drizzle-orm/pg-core";
import { z } from "zod";
import { audits, timestamps } from "../core/columns";
import { providerSchema } from "./provider";
import { timelineEntrySchema } from "../timeline/timelineEntry";
import { uuidV5 } from "../core/uuidV5";

// Which providers an event or note was with: one row per (entry, provider).
// A visit with the clinic and a call to the pharmacy link both.
//
// The id is derived from the pair (`entryProviderId`), so two devices that
// link the same provider offline write the same row, and replays land on it.
// Unlinking deletes the row; linking again writes the same id.

/** Only notes and events link to providers. */
export const PROVIDER_LINK_KINDS = ["note", "event"] as const satisfies readonly TimelineEntryKind[];
export const canLinkProviders = (kind: string): kind is (typeof PROVIDER_LINK_KINDS)[number] =>
  (PROVIDER_LINK_KINDS as readonly string[]).includes(kind);

/** The namespace for link ids (a fixed, random UUID; never change it). */
export const ENTRY_PROVIDER_NAMESPACE = "7c0e4f2a-9a51-4d5e-8b3f-2f6d1c9e4a10";

/** A link's id: the version 5 UUID of its entry and provider ids. Case-insensitive in its inputs. */
export const entryProviderId = (entryId: string, providerId: string) =>
  uuidV5(`${entryId.toLowerCase()}:${providerId.toLowerCase()}`, ENTRY_PROVIDER_NAMESPACE);

export const timelineEntryProviderSchema = pgTable(
  "timeline_entry_provider",
  {
    // Always given: entryProviderId(entryId, providerId).
    id: uuid("id").primaryKey(),
    groupId: uuid("group_id").notNull(),
    entryId: uuid("entry_id").notNull(),
    providerId: uuid("provider_id").notNull(),
    ...timestamps,
    ...audits,
  },
  (t) => [
    // Both ends must be in the link's group; a hard delete of either removes the link.
    foreignKey({
      name: "timeline_entry_provider_entry_fk",
      columns: [t.groupId, t.entryId],
      foreignColumns: [timelineEntrySchema.groupId, timelineEntrySchema.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "timeline_entry_provider_provider_fk",
      columns: [t.groupId, t.providerId],
      foreignColumns: [providerSchema.groupId, providerSchema.id],
    }).onDelete("cascade"),
    unique("timeline_entry_provider_entry_provider_unique").on(t.entryId, t.providerId),
    // A provider's linked entries.
    index("timeline_entry_provider_provider_idx").on(t.providerId),
  ],
);

export type TimelineEntryProviderSchema = typeof timelineEntryProviderSchema;
export type TimelineEntryProviderSelect = InferSelectModel<TimelineEntryProviderSchema>;
export type TimelineEntryProviderInsert = Omit<InferInsertModel<TimelineEntryProviderSchema>, ProtectedField>;
export type TimelineEntryProvider = TimelineEntryProviderSelect;

/**
 * Link a provider to an entry. `id`, when given (a device's upload), must be
 * the pair's derived id.
 */
export const entryProviderLinkZSchema = z
  .strictObject({
    id: z.uuid().optional(),
    groupId: z.uuid(),
    entryId: z.uuid(),
    providerId: z.uuid(),
  })
  .refine((v) => !v.id || v.id.toLowerCase() === entryProviderId(v.entryId, v.providerId), {
    path: ["id"],
    error: "A link's id comes from its entry and provider",
  });
export type EntryProviderLinkInput = z.input<typeof entryProviderLinkZSchema>;
