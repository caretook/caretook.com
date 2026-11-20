import type { RememberKey } from "./remembered";
import type { LocalQuery } from "../timeline/timeline.sync";

import { useEffect, useState } from "react";
import { syncUserId, watchLiveQuery } from "./index";
import { recall, remember } from "./remembered";

type State<T> = { initial: T[] | undefined; rows: T[] | undefined; sql: string | null };

/**
 * A live query whose answers are remembered for the session (the tile
 * cache, `remembered.ts`), for the timeline's header tiles. Returns
 * `{ value, fresh }`:
 *
 * - before this query's first answer, the last answer remembered under `key`
 *   (`fresh: false`), so a tile mounted again paints at once, dimmed; with
 *   nothing remembered, `value` is undefined (the tile shows a skeleton);
 * - from its first answer on, the live rows (`fresh: true`), whatever they say.
 *
 * Every answer is remembered. `initial` is a loader's read of the same query
 * (pass the same array while it's unchanged): it counts as fresh, and new
 * loader data replaces what the watch last said, as with `useLiveQuery`.
 * When only the query changes (its day moved on), the previous answer stays
 * up, not fresh, until the new one arrives.
 */
export function useRememberedQuery<T>(
  key: RememberKey,
  query: LocalQuery,
  initial?: T[],
): { value: T[] | undefined; fresh: boolean } {
  const sql = JSON.stringify([query.sql, query.params]);
  const userId = syncUserId();
  const { groupId, name } = key;
  const [state, setState] = useState<State<T>>({ initial, rows: initial, sql: null });

  let current = state;
  if (state.initial !== initial) {
    current = { initial, rows: initial, sql: null };
    setState(current);
  }

  useEffect(
    () =>
      watchLiveQuery<T>(sql, (rows) => {
        if (userId) remember(userId, { groupId, name }, rows);
        setState((s) => ({ ...s, rows, sql }));
      }),
    [sql, userId, groupId, name],
  );

  if (current.sql === sql) return { value: current.rows, fresh: true };
  if (initial) return { value: initial, fresh: true };
  const remembered = userId ? recall<T[]>(userId, { groupId, name }) : undefined;
  return { value: remembered ?? current.rows, fresh: false };
}
