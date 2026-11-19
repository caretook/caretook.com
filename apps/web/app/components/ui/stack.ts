/** The first `max` items to show, and how many more there are ("+N"). */
export function splitStack<T>(items: readonly T[], max: number): { shown: T[]; extra: number } {
  const shown = items.slice(0, Math.max(0, max));
  return { shown, extra: items.length - shown.length };
}
