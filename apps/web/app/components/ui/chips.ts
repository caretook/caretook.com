import type { To } from "react-router";

/** A chip that's a link (a filter): `current` marks the one in effect (`aria-current`). */
export type LinkChip = { id: string; label: string; to: To; current: boolean };
/** A chip that's a button (a suggestion, or a toggle when `pressed` is set). */
export type ActionChip = { id: string; label: string; onPress: () => void; pressed?: boolean };
