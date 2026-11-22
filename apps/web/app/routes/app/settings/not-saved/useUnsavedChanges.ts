import type { UnsavedRecord } from "~/lib/app-shell/unsavedChanges";

import { useCallback, useMemo } from "react";
import { unsavedLines } from "~/lib/app-shell/unsavedChanges";
import { dismissAllUnsaved, dismissUnsaved, UNSAVED_SQL } from "~/lib/app-shell/unsavedChanges.sync";
import { getSync, useLiveQuery } from "~/lib/sync";

/** The page's lines, live (a refusal arriving shows at once), and dismissing them. */
export const useUnsavedChanges = (initial: UnsavedRecord[]) => {
  const records = useLiveQuery<UnsavedRecord>(UNSAVED_SQL, [], initial);
  const lines = useMemo(() => unsavedLines(records), [records]);
  const dismiss = useCallback((ids: readonly string[]) => dismissUnsaved(getSync(), ids), []);
  const dismissAll = useCallback(() => dismissAllUnsaved(getSync()), []);
  return { lines, dismiss, dismissAll };
};
