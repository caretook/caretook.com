import { index, pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";
import { userSchema } from "../auth/user";
import { timelineEntrySchema } from "./timelineEntry";

// Each dose upload the server accepted: a first upload or a replay onto the
// uploader's own row (B-726), a duplicate of another member's dose (B-627),
// and the two a restore settles, the one it displaced and its own (B-719).
// The name is from B-627. A retry looks exactly like a first upload, and the
// row may have changed time or hands since, so this is how the restore rule
// tells them apart: a match leaves a deleted dose deleted.
// The system's only (see PERMISSIONS): written and read by
// timelineEntryService.upsert, never through a model, and it never syncs.
// Its rows go with the entry (and so the group) and with the user.

export const doseDuplicateUploadSchema = pgTable(
  "dose_duplicate_upload",
  {
    entryId: uuid("entry_id")
      .notNull()
      .references(() => timelineEntrySchema.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => userSchema.id, { onDelete: "cascade" }),
    // The upload's own time, at full precision, so a retry matches exactly.
    occurredAt: timestamp("occurred_at", { mode: "string", withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { precision: 3, mode: "string", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.entryId, t.userId, t.occurredAt] }),
    index("dose_duplicate_upload_user_id_idx").on(t.userId),
  ],
);
