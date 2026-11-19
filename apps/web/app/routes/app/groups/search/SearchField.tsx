import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Field } from "~/components/ui";
import { appUrls } from "~/lib/appUrls";

/** Wait this long after the last keystroke before searching (and writing `?q=`). */
const DEBOUNCE_MS = 200;

/** Navigation state that marks a URL change as the field's own. */
const FROM_FIELD = { searchField: true } as const;
const isFromField = (state: unknown) => typeof state === "object" && state !== null && "searchField" in state;

/**
 * The search field, focused when the page opens. What's typed goes to
 * `?q=` a moment after the last keystroke, replacing the history entry
 * (so Back leaves the page, and returns to the same search); the results
 * follow the URL. A URL change from elsewhere (the header's magnifier on
 * this page, Back) puts its text back in the field. Leaving the field (or
 * pressing Enter) with text in it counts as using that search (`onUsed`).
 */
export function SearchField({
  groupId,
  urlQuery,
  period,
  label,
  onUsed,
}: {
  groupId: string;
  urlQuery: string;
  /** The care period the search is narrowed to: kept as the text changes (and dropped with it). */
  period: string | null;
  label: string;
  /** The search was used: the field was left, or submitted, with text in it. */
  onUsed: (q: string) => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [text, setText] = useState(urlQuery);
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // A navigation that isn't the field's own (React's "adjust state on a prop change").
  const [seenKey, setSeenKey] = useState(location.key);
  if (seenKey !== location.key) {
    setSeenKey(location.key);
    if (!isFromField(location.state)) setText(urlQuery);
  }

  // Focused on open, with the caret after any text (a search came back to),
  // without scrolling away from where Back left the results.
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const commit = (value: string) => {
    clearTimeout(timer.current);
    void navigate(appUrls.search(groupId, value, { period }), {
      replace: true,
      preventScrollReset: true,
      state: FROM_FIELD,
    });
  };

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        commit(text);
        onUsed(text);
      }}
    >
      <Field label={label} labelHidden>
        {(control) => (
          <div className="input input-lg w-full">
            <Search className="size-5 opacity-60" aria-hidden="true" />
            <input
              {...control}
              ref={input}
              type="search"
              name="q"
              placeholder="Search notes, providers, medications…"
              autoComplete="off"
              enterKeyHint="search"
              value={text}
              data-search-field
              onBlur={(e) => onUsed(e.currentTarget.value)}
              onChange={(e) => {
                const next = e.currentTarget.value;
                setText(next);
                clearTimeout(timer.current);
                timer.current = setTimeout(() => commit(next), DEBOUNCE_MS);
              }}
            />
          </div>
        )}
      </Field>
    </form>
  );
}
