import type { QuickEntryPass } from "@caretook/data/schema";
import type { DuePass } from "~/lib/duePasses";

import { useMemo } from "react";
import { sortPasses } from "@caretook/data/schema";
import { duePasses, isNamedPass, isPassDueNow } from "~/lib/duePasses";
import { useDueDoses } from "~/lib/sync/dueDoses";

const NONE: never[] = [];

/**
 * The group's passes as quick entry reads them, live from the device (so it
 * works offline) and re-evaluated with the clock: each live pass with
 * whether it's due now and how many of its medications are still open
 * today (the parser's `passes`), and today's named passes due now (the
 * one-tap chip, simple mode's Now block). Nothing until the device's rows
 * are read, so "gave meds" never means a pass that only looks due.
 */
export function useQuickEntryPasses(groupId: string): {
  passes: readonly QuickEntryPass[];
  dueNow: readonly (DuePass & { passId: string; name: string })[];
} {
  const { due, ready, passes } = useDueDoses(groupId);
  return useMemo(() => {
    if (!ready) return { passes: NONE, dueNow: NONE };
    const today = duePasses(due, passes).filter(isNamedPass);
    const quick = sortPasses(passes.filter((p) => !p.deletedAt)).map((pass): QuickEntryPass => {
      const day = today.find((d) => d.passId === pass.id);
      return {
        id: pass.id,
        name: pass.name,
        time: pass.time,
        due: !!day && isPassDueNow(day),
        open: day?.open.length ?? 0,
      };
    });
    return { passes: quick, dueNow: today.filter(isPassDueNow) };
  }, [due, ready, passes]);
}
