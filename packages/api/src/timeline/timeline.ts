import type { VitalReading } from "@caretook/data";

import { ORPCError } from "@orpc/server";
import { z } from "zod";
import {
  isKnownReading,
  TIMELINE_ENTRY_KINDS,
  timelineEntryCreateZSchema,
  timelineEntryService,
  timelineEntryUpdateZSchema,
} from "@caretook/data";
import { iso, toTimelineEntry } from "../dto";
import { unwrap } from "../errors";
import { authedProcedure } from "../procedures";
import { symptomTypes } from "./symptomTypes";

const id = z.uuid();

const timestamp = z.iso.datetime({ offset: true });

export const timeline = {
  /**
   * One group's entries, newest first. Pass `nextCursor` back as `cursor` for more.
   * A note's or event's `body` is its live document's compacted text (null until
   * the document arrives); deleted entries never carry their document's text.
   */
  list: authedProcedure
    .input(
      z.object({
        groupId: id,
        kinds: z.array(z.enum(TIMELINE_ENTRY_KINDS)).optional(),
        from: timestamp.optional(),
        to: timestamp.optional(),
        cursor: z.string().max(512).nullish(),
        limit: z.int().min(1).max(100).optional(),
        includeDeleted: z.boolean().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const page = unwrap(await timelineEntryService.list(context, input));
      return { data: page.data.map(toTimelineEntry), nextCursor: page.nextCursor };
    }),

  /**
   * The newest reading of each vital type in the group, for the "latest
   * vitals" strip. Readings of types this server doesn't know are skipped.
   */
  latestVitals: authedProcedure.input(z.object({ groupId: id })).handler(async ({ context, input }) => {
    const rows = unwrap(await timelineEntryService.latestVitals(context, input));
    return rows
      .filter((row) => isKnownReading(row.reading))
      .map((row) => ({
        entryId: row.entryId,
        occurredAt: iso(row.occurredAt),
        reading: row.reading as VitalReading,
      }));
  }),

  create: authedProcedure.input(timelineEntryCreateZSchema).handler(async ({ context, input }) => {
    const entry = unwrap(await timelineEntryService.create(context, input));
    // Created but not readable back: a permissions bug, not a client error.
    if (!entry) throw new ORPCError("INTERNAL_SERVER_ERROR");
    return toTimelineEntry(entry);
  }),

  update: authedProcedure
    .input(z.object({ id, data: timelineEntryUpdateZSchema }))
    .handler(async ({ context, input }) => {
      const updated = unwrap(await timelineEntryService.update(context, input.id, input.data));
      if (!updated) throw new ORPCError("NOT_FOUND");
      // A note's or event's body comes from its document, as in `list`.
      const [entry = updated] = unwrap(await timelineEntryService.withDocumentText(context, [updated]));
      return toTimelineEntry(entry);
    }),

  /** Soft delete. */
  remove: authedProcedure.input(z.object({ id })).handler(async ({ context, input }) => {
    unwrap(await timelineEntryService.remove(context, input.id));
    return { id: input.id };
  }),

  /** The group's symptom catalog: archive and unarchive (symptom-catalog-2). */
  symptomTypes,
};
