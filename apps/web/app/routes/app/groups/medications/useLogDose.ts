import type { TodayDose } from "./todayDose";
import type { ActionResult } from "~/lib/api";

import { useFetcher } from "react-router";
import { appUrls } from "~/lib/appUrls";
import { todayDoseFields } from "./todayDose";

/**
 * One Today control's save: posts a dose to the medications route (a local
 * write; the live queries show it at once). Each control has its own, so two
 * quick taps on different rows never cancel each other.
 */
export function useLogDose(groupId: string) {
  const fetcher = useFetcher<ActionResult>();
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  return {
    log: (dose: TodayDose) =>
      void fetcher.submit(todayDoseFields(dose), { method: "post", action: appUrls.medications(groupId) }),
    busy: fetcher.state !== "idle",
    error: result && !result.ok ? result.error : null,
  };
}
