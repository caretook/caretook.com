import type { ActionResult } from "~/lib/api";

import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

/**
 * An EntryForm's save: the fetcher it posts through, the result to show, and
 * what happens after a successful save. Adding clears the form for the next
 * entry (`resetKey` changes, so per-reading state such as warnings starts
 * over); both then call `onDone`. Each result counts once.
 */
export function useEntryFormSave({ adding, onDone }: { adding: boolean; onDone?: () => void }) {
  const fetcher = useFetcher<ActionResult>();
  const formRef = useRef<HTMLFormElement>(null);
  const [resetKey, setResetKey] = useState(0);
  const [savedResult, setSavedResult] = useState<ActionResult | undefined>(undefined);

  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  // Adjusted during render, not in an effect.
  if (adding && result?.ok && result !== savedResult) {
    setSavedResult(result);
    setResetKey((k) => k + 1);
  }

  const handled = useRef<ActionResult | undefined>(undefined);
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data?.ok || handled.current === fetcher.data) return;
    handled.current = fetcher.data;
    if (adding) formRef.current?.reset();
    onDone?.();
  }, [fetcher.state, fetcher.data, adding, onDone]);

  return {
    Form: fetcher.Form,
    formRef,
    resetKey,
    busy: fetcher.state !== "idle",
    /** The last save's outcome, once it's finished. */
    result,
    issues: result && !result.ok ? result.issues : [],
  };
}
