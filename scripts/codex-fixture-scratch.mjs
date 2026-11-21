// Throwaway file for capturing Codex review fixtures (github-review slice 1). Never merged.

/** The last n items of a list. */
export function lastItems(list, n) {
  return n > 0 ? list.slice(-n) : [];
}

/** The mean of a list of numbers (0 for an empty list). */
export function average(values) {
  if (values.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < values.length; i++) sum += values[i];
  return sum / values.length;
}

/** The first n items of a list. */
export const firstItems = (list, n) => list.slice(0, Math.max(0, n));
