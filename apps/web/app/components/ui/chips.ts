import type { ReactNode } from "react";
import type { To } from "react-router";

/**
 * A chip that's a link (a filter): `current` marks the one in effect
 * (`aria-current`). Optional: `leading` and `trailing` are decorative nodes
 * either side of the label (an avatar, a ✕), and `name` is the chip's
 * accessible name when the label alone doesn't say what it does.
 */
export type LinkChip = {
  id: string;
  label: string;
  to: To;
  current: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  name?: string;
};
/** A chip that's a button (a suggestion, or a toggle when `pressed` is set). */
export type ActionChip = { id: string; label: string; onPress: () => void; pressed?: boolean };
