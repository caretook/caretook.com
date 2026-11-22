// The accent palette (pure): six hues that belong to sections and kinds of
// entry, kept apart from the status colours so a colour never implies urgency.
// This is the one place that names an accent's classes; the tokens behind them
// are the `--color-hue-*` lines at the end of app.css.

export const ACCENTS = ["indigo", "teal", "orange", "lime", "plum", "pink"] as const;

export type Accent = (typeof ACCENTS)[number];
/** An accent, or the kit's plain grey. */
export type AccentOrNeutral = Accent | "neutral";
export type AccentLook = "solid" | "soft" | "text";

// Whole class names, so Tailwind finds them.
const CLASSES: Record<AccentOrNeutral, Record<AccentLook, string>> = {
  indigo: {
    solid: "bg-hue-indigo text-hue-content",
    soft: "bg-hue-indigo-tint text-hue-indigo-ink",
    text: "text-hue-indigo-ink",
  },
  teal: {
    solid: "bg-hue-teal text-hue-content",
    soft: "bg-hue-teal-tint text-hue-teal-ink",
    text: "text-hue-teal-ink",
  },
  orange: {
    solid: "bg-hue-orange text-hue-content",
    soft: "bg-hue-orange-tint text-hue-orange-ink",
    text: "text-hue-orange-ink",
  },
  lime: {
    solid: "bg-hue-lime text-hue-content",
    soft: "bg-hue-lime-tint text-hue-lime-ink",
    text: "text-hue-lime-ink",
  },
  plum: {
    solid: "bg-hue-plum text-hue-content",
    soft: "bg-hue-plum-tint text-hue-plum-ink",
    text: "text-hue-plum-ink",
  },
  pink: {
    solid: "bg-hue-pink text-hue-content",
    soft: "bg-hue-pink-tint text-hue-pink-ink",
    text: "text-hue-pink-ink",
  },
  neutral: {
    solid: "bg-base-300 text-base-content",
    soft: "bg-base-content/10 text-base-content",
    text: "text-muted",
  },
};

/** The classes for an accent (or neutral) in a look. */
export const accentClass = (accent: AccentOrNeutral, look: AccentLook) => CLASSES[accent][look];
