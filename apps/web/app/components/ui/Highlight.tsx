import type { HighlightRange } from "@caretook/data/domain";
import { highlightParts } from "@caretook/data/domain";

/**
 * The look of a matched word: the theme's warning colour with its own
 * content colour, so it keeps contrast in light and dark (and over muted or
 * struck-through text).
 */
export const MARK_CLASS = "bg-warning text-warning-content rounded-[2px] box-decoration-clone";

/**
 * `text` with the stretches in `ranges` as <mark> (whole words, so a screen
 * reader reads them as usual). Without ranges it's the text as it is.
 */
export function Highlight({ text, ranges }: { text: string; ranges?: readonly HighlightRange[] }) {
  if (!ranges?.length) return text;
  return highlightParts(text, ranges).map((part, i) =>
    part.match ? (
      <mark key={i} className={MARK_CLASS}>
        {part.text}
      </mark>
    ) : (
      part.text
    ),
  );
}
