import type { WaitlistEntryModel } from "@caretook/data";

import { waitlistFilterZSchema, waitlistService } from "@caretook/data";
import { z } from "zod";
import { iso } from "../dto";
import { unwrap } from "../errors";
import { staffProcedure } from "../procedures";

// `admin.waitlist.*` (marketing slice 5): the waitlist for Caretook staff
// (admin and support; a group's owner gets a 403 like anyone else). Each row
// is exactly what the visitor typed into the form, plus when they joined:
// no ids of who wrote it, nothing else about them.

/** Rows per page on /admin/waitlist. */
export const WAITLIST_PAGE_SIZE = 50;

export const toWaitlistEntry = (entry: WaitlistEntryModel) => ({
  id: entry.id,
  email: entry.email,
  firstName: entry.firstName,
  caringFor: entry.caringFor,
  heardFrom: entry.heardFrom,
  source: entry.source,
  createdAt: iso(entry.createdAt),
});
export type WaitlistEntryDto = ReturnType<typeof toWaitlistEntry>;

export const waitlistAdmin = {
  /** One page of the matching entries, newest first, and how many match in all. */
  list: staffProcedure("waitlist.read")
    .input(waitlistFilterZSchema.extend({ page: z.number().int().min(1).max(100_000).default(1) }))
    .handler(async ({ context, input: { page, ...filter } }) => {
      const res = unwrap(await waitlistService.search(context, filter, { page, limit: WAITLIST_PAGE_SIZE }));
      return { count: res.count, page, pageSize: WAITLIST_PAGE_SIZE, entries: res.data.map(toWaitlistEntry) };
    }),

  /** Every matching entry, newest first: what the CSV export holds. */
  export: staffProcedure("waitlist.read")
    .input(waitlistFilterZSchema)
    .handler(async ({ context, input }) =>
      unwrap(await waitlistService.exportAll(context, input)).map(toWaitlistEntry),
    ),
};
