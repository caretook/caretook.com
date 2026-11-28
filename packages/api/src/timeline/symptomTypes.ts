import type { SymptomType } from "@caretook/data";

import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { symptomTypeService } from "@caretook/data";
import { iso } from "../dto";
import { unwrap } from "../errors";
import { authedProcedure } from "../procedures";

// A group's symptom catalog, online (symptom-catalog-2). Devices read the
// catalog through sync and add names through it; archiving is server-set,
// so it's here, never uploaded. Writers only (`WRITERS`): a member of
// another role gets a 403, a non-member's or another group's row a 404, a
// merged row (a tombstone) a 409. `replace` (symptom-catalog-3) is the
// owners' delete: it moves a symptom's entries to another and leaves a
// tombstone, in one transaction.

const id = z.uuid();

const rowInput = z.object({ groupId: id, id });

const replaceInput = z.object({ groupId: id, id, replacementId: id });

/** A catalog row as the API returns it: timestamps as ISO 8601. */
const toSymptomType = (row: SymptomType) => ({
  ...row,
  archivedAt: row.archivedAt ? iso(row.archivedAt) : null,
  createdAt: iso(row.createdAt),
  updatedAt: iso(row.updatedAt),
});

const answer = (row: SymptomType | null) => {
  if (!row) throw new ORPCError("NOT_FOUND");
  return toSymptomType(row);
};

export const symptomTypes = {
  /** Archive a symptom: it leaves suggestions and pickers; its entries stay. A repeat answers the row unchanged. */
  archive: authedProcedure.input(rowInput).handler(async ({ context, input }) => {
    return answer(unwrap(await symptomTypeService.archive(context, input)));
  }),

  /** Bring an archived symptom back. A repeat answers the row unchanged. */
  unarchive: authedProcedure.input(rowInput).handler(async ({ context, input }) => {
    return answer(unwrap(await symptomTypeService.unarchive(context, input)));
  }),

  /**
   * Delete a symptom into another (owners only): its entries, deleted ones
   * too, move to the replacement, and it becomes a tombstone. Answers how
   * many entries moved; a rerun is refused (409).
   */
  replace: authedProcedure.input(replaceInput).handler(async ({ context, input }) => {
    return unwrap(await symptomTypeService.replace(context, input));
  }),
};
