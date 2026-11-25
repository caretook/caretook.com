import type { TodayDose } from "./todayDose";
import type { CreateResult } from "~/lib/core/api";

import { useFetcher } from "react-router";
import { appUrls } from "~/lib/app-shell/appUrls";
import { todayDoseFields } from "./todayDose";

/**
 * One Today control's save: posts a dose to the Schedule tab's route (a local
 * write; the live queries show it at once). Each control has its own, so two
 * quick taps on different rows never cancel each other. `loggedId` is the
 * last save's dose, for its Undo.
 */
export function useLogDose(groupId: string) {
  const fetcher = useFetcher<CreateResult>();
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  return {
    log: (dose: TodayDose) =>
      void fetcher.submit(todayDoseFields(dose), {
        method: "post",
        action: appUrls.medicationSchedule(groupId),
      }),
    busy: fetcher.state !== "idle",
    /** The last save's dose id, once it's through (a new string per save). */
    loggedId: result?.ok ? result.id : null,
    error: result && !result.ok ? result.error : null,
  };
}
