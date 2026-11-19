import { useEffect, useState } from "react";
import { watchLiveQuery } from "~/lib/sync";

type State<T> = { initial: T[]; rows: T[]; key: string | null };

/**
 * `useLiveQuery` for the timeline's growing window, which also says whether
 * the rows are the current query's own (`fresh`): when the query grows, the
 * previous rows stay up, and `fresh` is false, until the new results arrive.
 * New loader data replaces the rows only when the query changed with it (a
 * new filter); for the same query the watch is already live, so the loaded
 * pages stay (re-tapping the filter that's on).
 */
export const useLiveRows = <T>(
  sql: string,
  params: unknown[],
  initial: T[],
): { rows: T[]; fresh: boolean } => {
  const key = JSON.stringify([sql, params]);
  const [state, setState] = useState<State<T>>({ initial, rows: initial, key: null });

  let current = state;
  if (state.initial !== initial) {
    current = state.key === key ? { ...state, initial } : { initial, rows: initial, key: null };
    setState(current);
  }

  useEffect(() => watchLiveQuery<T>(key, (rows) => setState((s) => ({ ...s, rows, key }))), [key]);

  return { rows: current.rows, fresh: current.key === key };
};
