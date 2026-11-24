import type { UnsavedLine, UnsavedRecord } from "~/lib/app-shell/unsavedChanges";

import { useCallback, useMemo, useState } from "react";
import { unsavedLines } from "~/lib/app-shell/unsavedChanges";
import {
  dismissAllUnsaved,
  dismissUnsaved,
  retryUnsaved,
  UNSAVED_SQL,
} from "~/lib/app-shell/unsavedChanges.sync";
import { rpc } from "~/lib/core/rpc";
import { getSync, useLiveQuery } from "~/lib/sync";

/** A line's "Try again": sending, or the request failed as a whole (offline, the server down). */
export type TryAgainState = "sending" | "unreachable";

/** The page's lines, live (a refusal arriving shows at once), and dismissing or resending them. */
export const useUnsavedChanges = (initial: UnsavedRecord[]) => {
  const records = useLiveQuery<UnsavedRecord>(UNSAVED_SQL, [], initial);
  const lines = useMemo(() => unsavedLines(records), [records]);
  const [tries, setTries] = useState<Readonly<Record<string, TryAgainState>>>({});
  const dismiss = useCallback((ids: readonly string[]) => dismissUnsaved(getSync(), ids), []);
  const dismissAll = useCallback(() => dismissAllUnsaved(getSync()), []);
  const tryAgain = useCallback(async (line: UnsavedLine) => {
    const mark = (state: TryAgainState | null) =>
      setTries(({ [line.key]: _, ...rest }) => (state ? { ...rest, [line.key]: state } : rest));
    mark("sending");
    try {
      await retryUnsaved(getSync(), line.ids, (input) => rpc.sync.upload(input));
      mark(null);
    } catch {
      mark("unreachable");
    }
  }, []);
  return { lines, dismiss, dismissAll, tryAgain, tries };
};
