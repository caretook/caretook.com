import type { AvatarColor, AvatarIcon } from "@caretook/data/schema";
import type { LucideIcon } from "lucide-react";

import {
  Anchor,
  Bird,
  Cat,
  Cloud,
  Coffee,
  Dog,
  Feather,
  Fish,
  Flower,
  Leaf,
  Moon,
  Mountain,
  Music,
  Star,
  Sun,
  TreePine,
} from "lucide-react";

// The one place that names the avatar colors' classes and the icons' glyphs.
// The tokens behind the classes are the `--color-avatar-*` lines in app.css.

// Whole class names, so Tailwind finds them.
const COLOR_CLASSES = new Map<string, string>([
  ["coral", "bg-avatar-coral text-avatar-content"],
  ["ochre", "bg-avatar-ochre text-avatar-content"],
  ["moss", "bg-avatar-moss text-avatar-content"],
  ["fern", "bg-avatar-fern text-avatar-content"],
  ["jade", "bg-avatar-jade text-avatar-content"],
  ["sky", "bg-avatar-sky text-avatar-content"],
  ["blue", "bg-avatar-blue text-avatar-content"],
  ["violet", "bg-avatar-violet text-avatar-content"],
  ["orchid", "bg-avatar-orchid text-avatar-content"],
  ["rose", "bg-avatar-rose text-avatar-content"],
] satisfies [AvatarColor, string][]);

const ICON_GLYPHS = new Map<string, LucideIcon>([
  ["flower", Flower],
  ["leaf", Leaf],
  ["tree", TreePine],
  ["sun", Sun],
  ["moon", Moon],
  ["star", Star],
  ["cloud", Cloud],
  ["mountain", Mountain],
  ["bird", Bird],
  ["cat", Cat],
  ["dog", Dog],
  ["fish", Fish],
  ["coffee", Coffee],
  ["music", Music],
  ["anchor", Anchor],
  ["feather", Feather],
] satisfies [AvatarIcon, LucideIcon][]);

/** The classes for a color id; undefined when unset or unknown (a newer device's id). */
export const avatarColorClass = (color?: string | null) => (color ? COLOR_CLASSES.get(color) : undefined);

/** The glyph for an icon id; undefined when unset or unknown. */
export const avatarIconGlyph = (icon?: string | null) => (icon ? ICON_GLYPHS.get(icon) : undefined);
