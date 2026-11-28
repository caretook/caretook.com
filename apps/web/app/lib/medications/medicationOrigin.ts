import { useLocation } from "react-router";
import { groupHome } from "../core/urls";
import { medicationUrls } from "./urls";

// Where a medication's page was opened from, for its Back link: a link
// that opens the page (Schedule, the list, Passes, a provider, a todo,
// search, a condition, a timeline entry, the setup flow's medications
// step) carries the screen it was on, with its search and filters, in
// history state (`medicationPageState`). The
// page reads it back (`medicationOriginFromState`) and names that screen;
// without it (a direct load, a reload with no state, a shared link) Back is
// the Medications list. History state, not a step back: it survives sheets
// opened over the page and closed again. The label is worked out again from
// the URL on the way back, never trusted from the state.

/** Where the page's Back goes, and what it says. */
export type MedicationOrigin = { url: string; label: string };

const KEY = "medicationFrom";

/** History state on a link to a medication's page: the screen it's on (`pathname` and `search`). */
export const medicationPageState = (url: string) => ({ [KEY]: url });

/** The label for a screen inside the group (its path after the group's home), or null for one that opens no medication. */
const labelFor = (path: string): string | null => {
  const parts = path.split("/").filter(Boolean);
  const [first, second, third] = parts;
  if (first === "medications") {
    if (second === "schedule") return "Schedule";
    if (second === "list") return "Medications";
    if (second === "passes") return "Med times";
    return null;
  }
  // The setup flow's medications step lists what it adds; its label is the
  // step's heading (`SETUP_STEP_META.medications.title`).
  if (first === "setup" && second === "medications" && parts.length === 2) return "Medications";
  if (first === "timeline") return "Timeline";
  if (first === "search" && parts.length === 1) return "Search";
  if (first === "planner") return "Planner";
  if (first === "providers" && parts.length === 2 && second !== "new" && second !== "import")
    return "Provider";
  if (first === "todos" && parts.length === 2 && second !== "new") return "Todo";
  if (first === "profile" && second === "conditions" && parts.length === 3 && third !== "new")
    return "Condition";
  return null;
};

/**
 * The screen a medication's page was opened from (`medicationPageState`),
 * when it's one of this group's screens that opens medications; else the
 * Medications list.
 */
export const medicationOriginFromState = (groupId: string, state: unknown): MedicationOrigin => {
  const fallback = { url: medicationUrls.medicationList(groupId), label: "Medications" };
  if (typeof state !== "object" || state === null || !(KEY in state)) return fallback;
  const from = (state as Record<string, unknown>)[KEY];
  if (typeof from !== "string" || !from.startsWith("/") || from.startsWith("//")) return fallback;
  let url: URL;
  try {
    url = new URL(from, "http://caretook.invalid");
  } catch {
    return fallback;
  }
  if (url.origin !== "http://caretook.invalid") return fallback;
  const home = `${groupHome(groupId)}/`;
  if (!url.pathname.startsWith(home)) return fallback;
  const label = labelFor(url.pathname.slice(home.length));
  return label ? { url: `${url.pathname}${url.search}`, label } : fallback;
};

/** The history state for a link to a medication's page from the screen this renders on. */
export function useMedicationLinkState() {
  const { pathname, search } = useLocation();
  return medicationPageState(`${pathname}${search}`);
}
