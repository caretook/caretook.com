import type { TimelineEntryModel } from "@caretook/data";

// What the API returns. Postgres timestamptz text ("2026-11-17 10:00:00+00")
// becomes ISO 8601, so every client parses one format.

const iso = (value: string) => new Date(value).toISOString();

export const toTimelineEntry = (entry: TimelineEntryModel) => ({
  ...entry,
  occurredAt: iso(entry.occurredAt),
  createdAt: iso(entry.createdAt),
  updatedAt: iso(entry.updatedAt),
  deletedAt: entry.deletedAt ? iso(entry.deletedAt) : null,
});

export type TimelineEntryDto = ReturnType<typeof toTimelineEntry>;
