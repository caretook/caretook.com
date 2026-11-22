// The one map from a badge's tone to its daisyUI classes (pure, unit-tested),
// and the table every status badge takes its tone from.

/** A badge's colour. Every badge is one size and soft. */
export type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

const TONE: Record<BadgeTone, string> = {
  neutral: "badge-neutral",
  primary: "badge-primary",
  success: "badge-success",
  warning: "badge-warning",
  danger: "badge-error",
  info: "badge-info",
};

export const badgeClass = (tone: BadgeTone = "neutral") => `badge badge-sm badge-soft ${TONE[tone]}`;

/**
 * The status tones table: a status badge's colour means the same on every
 * page. Features keep their own labels ("Past", "Now", "Stopped") and pick the
 * tone here.
 */
export const STATUS_TONE = {
  /** Current, now, this one. */
  current: "primary",
  /** Past, stopped, ended. */
  past: "neutral",
  overdue: "danger",
  dueSoon: "warning",
  done: "success",
} as const satisfies Record<string, BadgeTone>;
