import { useLocation } from "react-router";
import { groupHome } from "../core/urls";

// Where an entry's page was opened from, for its Back link (B-936), beside
// the Planner's own return (lib/appointments/plannerReturn.ts, B-690): a
// link that opens the page from a provider's page (its linked entries, its
// visit prep) or a todo's (its linked notes and events) carries that screen
// in history state (`entryOriginState`). The page reads it back
// (`entryOriginFrom`) and names that screen; without it (a direct link, a
// reload with no state, any other opener) Back is the Timeline. The label is
// worked out from the URL, never trusted from the state. Pure but for the
// hook; unit-tested in web:unit.

/** The opener as a link writes it: its URL (path and search) and its history index, when known. */
export type EntryOpener = { from: string; idx: number | null };

/** The opener as the entry page reads it: where Back goes, and what it says. */
export type EntryOrigin = EntryOpener & { label: string };

const KEY = "entryFrom";

/** The history state for a link to an entry's page (merged into `extra`). */
export const entryOriginState = <T extends object>(opener: EntryOpener, extra?: T) =>
  ({ ...extra, [KEY]: { from: opener.from, idx: opener.idx } }) as T & { [KEY]: EntryOpener };

/** The label for a screen inside the group (its path after the group's home), or null for one that isn't an opener. */
const labelFor = (path: string): string | null => {
  const [first, second, ...rest] = path.split("/").filter(Boolean);
  if (!second || rest.length) return null;
  if (first === "providers" && second !== "new" && second !== "import") return "Provider";
  if (first === "todos" && second !== "new") return "Todo";
  return null;
};

/** The opener in history state, when it's one of this group's screens that carries one; else null. */
export const entryOriginFrom = (groupId: string, state: unknown): EntryOrigin | null => {
  if (!state || typeof state !== "object") return null;
  const opener = (state as Record<string, unknown>)[KEY];
  if (!opener || typeof opener !== "object") return null;
  const { from, idx } = opener as Record<string, unknown>;
  // Only a path in this app: never another origin.
  if (typeof from !== "string" || !from.startsWith("/") || from.startsWith("//")) return null;
  let url: URL;
  try {
    url = new URL(from, "http://caretook.invalid");
  } catch {
    return null;
  }
  if (url.origin !== "http://caretook.invalid") return null;
  const home = `${groupHome(groupId)}/`;
  if (!url.pathname.startsWith(home)) return null;
  const label = labelFor(url.pathname.slice(home.length));
  if (!label) return null;
  return { from: `${url.pathname}${url.search}`, idx: typeof idx === "number" ? idx : null, label };
};

/** This screen as an entry page's opener: the history state for a link from it. */
export function useEntryOpenerState() {
  const { pathname, search } = useLocation();
  const idx: unknown =
    typeof window === "undefined" ? null : (window.history.state as { idx?: unknown } | null)?.idx;
  return entryOriginState({ from: `${pathname}${search}`, idx: typeof idx === "number" ? idx : null });
}
