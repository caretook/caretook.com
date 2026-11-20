// How `loadSettings` answers a loader (B-156). Pure; unit-tested.

/**
 * - `answer`: `cache` returns the cached settings (pending changes on top) at
 *   once and refreshes in the background; `wait` (no cache: a new device, or
 *   storage unavailable) waits for the server, under `NETWORK_ANSWER_MS`,
 *   then falls back to defaults.
 * - `send`: the pending change the refresh sends before reading `me.get`, or
 *   null for none. An empty change counts as none.
 */
export type SettingsPlan<C> = { answer: "cache" | "wait"; send: C | null };

export const settingsPlan = <C extends object>({
  cached,
  pending,
}: {
  cached: boolean;
  pending: C | null;
}): SettingsPlan<C> => ({
  answer: cached ? "cache" : "wait",
  send: pending && Object.keys(pending).length > 0 ? pending : null,
});
