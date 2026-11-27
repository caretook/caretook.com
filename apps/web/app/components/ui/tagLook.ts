import type { TagColor } from "@caretook/data/schema";

// The one place that names the tag colors' classes (tags-2). A tag's colors
// are the avatar colors (`TAG_COLORS`), so a chip takes the same
// `--color-avatar-*` tokens and `--color-avatar-content` text as an avatar
// (app.css), with their contrast in both themes.

// Whole class names, so Tailwind finds them.
const COLOR_CLASSES = new Map<string, string>([
  ["coral", "bg-avatar-coral border-avatar-coral text-avatar-content"],
  ["ochre", "bg-avatar-ochre border-avatar-ochre text-avatar-content"],
  ["moss", "bg-avatar-moss border-avatar-moss text-avatar-content"],
  ["fern", "bg-avatar-fern border-avatar-fern text-avatar-content"],
  ["jade", "bg-avatar-jade border-avatar-jade text-avatar-content"],
  ["sky", "bg-avatar-sky border-avatar-sky text-avatar-content"],
  ["blue", "bg-avatar-blue border-avatar-blue text-avatar-content"],
  ["violet", "bg-avatar-violet border-avatar-violet text-avatar-content"],
  ["orchid", "bg-avatar-orchid border-avatar-orchid text-avatar-content"],
  ["rose", "bg-avatar-rose border-avatar-rose text-avatar-content"],
] satisfies [TagColor, string][]);

/**
 * The fill classes for a tag's color id; undefined when unset or unknown (a
 * newer device's id), which is the neutral chip.
 */
export const tagColorClass = (color?: string | null) => (color ? COLOR_CLASSES.get(color) : undefined);
