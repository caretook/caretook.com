import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { normalizeQuery, parseFilters, setQuery } from "~/lib/timelineFilters";

/** How long typing pauses before the URL (and so the list) follows. */
export const SEARCH_DEBOUNCE_MS = 250;

/**
 * The timeline's search field: whether it's open, what's typed, and the URL
 * following the typing (`?q=`, debounced, replacing the history entry and
 * keeping the scroll). `q` is the search in the URL now; a change from
 * elsewhere (the chip's ✕, Back) shows in the field.
 */
export function useSearchField(q: string) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(q);
  // What this field last sent, so its own URL change doesn't overwrite newer typing.
  const [sent, setSent] = useState(q);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // The latest search string, for a send that fires after a navigation.
  const search = useRef(location.search);
  useEffect(() => {
    search.current = location.search;
  }, [location.search]);

  // A search changed from elsewhere shows in the field.
  const [seen, setSeen] = useState(q);
  if (seen !== q) {
    setSeen(q);
    if (q !== sent) {
      setSent(q);
      setValue(q);
    }
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  const send = (text: string) => {
    clearTimeout(timer.current);
    const next = normalizeQuery(text);
    if (next === parseFilters(search.current).q) return;
    setSent(next);
    void navigate({ search: setQuery(search.current, next) }, { replace: true, preventScrollReset: true });
  };

  return {
    open,
    value,
    /** The field changed: show it, and update the URL once typing pauses. */
    change: (text: string) => {
      setValue(text);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => send(text), SEARCH_DEBOUNCE_MS);
    },
    /** Update the URL now (Enter). */
    submit: () => send(value),
    toggle: () => setOpen((o) => !o),
    /** Close the field; the search stays (its chip shows it). */
    close: () => {
      send(value);
      setOpen(false);
    },
  };
}
