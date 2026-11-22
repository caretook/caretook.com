// The one map from a badge's tone to its daisyUI classes (pure, unit-tested),
// and the table every status badge takes its tone from.

/** A badge's colour. Every badge is one size and soft. */
export type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

// The tint is daisyUI's soft badge; the text is the tone's ink (app.css), so
// it keeps 4.5:1 on its tint in both themes.
const TONE: Record<BadgeTone, string> = {
  neutral: "badge-neutral text-neutral-ink",
  primary: "badge-primary text-primary-ink",
  success: "badge-success text-success-ink",
  warning: "badge-warning text-warning-ink",
  danger: "badge-error text-error-ink",
  info: "badge-info text-info-ink",
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
