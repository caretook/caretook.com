import { useEffect, useState } from "react";

/** Example lines the empty box's placeholder cycles through; the first is the still one. */
export const QUICK_ENTRY_EXAMPLES = [
  "bp 130/85 hr 72",
  "gave metformin",
  "pain 4 left knee",
  "appt Dr Lee Friday 2pm",
  "n: slept well",
] as const;

/** How long each example shows. */
export const PLACEHOLDER_MS = 4000;

/** The full rules, for the box's accessible description. */
export const QUICK_ENTRY_RULES =
  "Commas separate entries. Start a part with “n:” for a note. Examples: bp 130/85 hr 72, gave metformin, pain 4 left knee, appt Dr Lee Friday 2pm.";

const reducedMotion = () => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

/**
 * The placeholder to show: one example, changing every few seconds while
 * `active` (the box is empty and unfocused), the first and still otherwise,
 * and always the first under `prefers-reduced-motion`.
 */
export function useRotatingPlaceholder(active: boolean): string {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!active || reducedMotion()) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % QUICK_ENTRY_EXAMPLES.length), PLACEHOLDER_MS);
    return () => clearInterval(timer);
  }, [active]);
  return QUICK_ENTRY_EXAMPLES[reducedMotion() || !active ? 0 : index]!;
}
