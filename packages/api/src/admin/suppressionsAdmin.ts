import { clearSuppressionZSchema, emailSuppressionService, suppressionSearchZSchema } from "@caretook/data";
import { iso } from "../dto";
import { unwrap } from "../errors";
import { staffProcedure } from "../procedures";

// `admin.suppressions.*` (hosting PRD, slice 4): the addresses we no longer
// mail after a hard bounce or a complaint. Every staff member lists them
// (`users.read`); clearing one so it gets mail again needs `users.help` and
// a reason, and is in the audit log. Named fields only: the address, why
// and when.

export const suppressionsAdmin = {
  /** One page of the active suppressions whose address contains `query`, newest first, and how many match. */
  list: staffProcedure("users.read")
    .input(suppressionSearchZSchema)
    .handler(async ({ context, input }) => {
      const res = unwrap(await emailSuppressionService.list(context, input));
      return {
        count: res.count,
        page: res.page,
        pageSize: res.pageSize,
        suppressions: res.data.map((row) => ({
          id: row.id,
          address: row.address,
          reason: row.reason,
          createdAt: iso(row.createdAt),
        })),
      };
    }),

  /** Clear one address's suppression, with why. */
  clear: staffProcedure("users.help")
    .input(clearSuppressionZSchema)
    .handler(async ({ context, input }) => unwrap(await emailSuppressionService.clear(context, input))),
};
