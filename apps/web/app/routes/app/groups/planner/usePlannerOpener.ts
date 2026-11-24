import type { PlannerReturn } from "~/lib/appointments/plannerReturn";

import { useLocation } from "react-router";

/** This Planner tab as an entry page's opener (B-690): its URL with the filters, and its history index. */
export function usePlannerOpener(added: boolean): PlannerReturn {
  const { pathname, search } = useLocation();
  const idx: unknown =
    typeof window === "undefined" ? null : (window.history.state as { idx?: unknown })?.idx;
  return { from: `${pathname}${search}`, added, idx: typeof idx === "number" ? idx : null };
}
