import type { LucideIcon } from "lucide-react";
import type { AccentLook, AccentOrNeutral } from "./accents";

import { accentClass } from "./accents";

export type IconChipLook = Exclude<AccentLook, "text">;
export type IconChipSize = "sm" | "md" | "lg";

const BOX: Record<IconChipSize, { box: string; icon: string }> = {
  sm: { box: "size-6", icon: "size-3.5" },
  md: { box: "size-8", icon: "size-4" },
  lg: { box: "size-12", icon: "size-6" },
};

/**
 * An icon in a coloured box: the one way to draw one. Decorative (hidden from
 * the accessibility tree) unless given a `label`, which names it as an image.
 * `title` is hover text only.
 */
export function IconChip({
  icon: Icon,
  accent = "neutral",
  look = "soft",
  size = "md",
  shape = "round",
  label,
  title,
}: {
  icon: LucideIcon;
  accent?: AccentOrNeutral;
  look?: IconChipLook;
  size?: IconChipSize;
  shape?: "round" | "rounded";
  label?: string;
  title?: string;
}) {
  const { box, icon } = BOX[size];
  const corners = shape === "round" ? "rounded-full" : "rounded-field";
  const naming = label ? ({ role: "img", "aria-label": label } as const) : ({ "aria-hidden": true } as const);
  return (
    <span
      {...naming}
      data-icon-chip
      title={title}
      className={`${box} ${corners} ${accentClass(accent, look)} inline-flex shrink-0 items-center justify-center`}
    >
      <Icon className={icon} strokeWidth={2.25} aria-hidden="true" />
    </span>
  );
}
