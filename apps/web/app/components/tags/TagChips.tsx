import type { ReactNode } from "react";

import { X } from "lucide-react";
import { Badge, tagColorClass } from "~/components/ui";
import { chipSplit } from "~/lib/tags/tagPicker";

type ChipTag = { id: string; name: string; color?: string | null };

/**
 * A record's tags as small chips: on rows the first two, then "+N"
 * (`chipSplit`); `max` null shows them all (a record's own page). Nothing
 * when it has none. Every role sees them. Each chip takes its tag's color
 * (`tagColorClass`); a null or unknown color is the neutral chip.
 *
 * `onRemove` gives each chip an × button ("Remove tag <name>"), and
 * `onMore` makes "+N" a button (it opens the picker); `add` (Add tag) is the
 * list's last item, a wider gap after the chips on its line and flush left
 * when it wraps to a line of its own (B-1023); all three are `QuickTags`'s,
 * for whoever may tag the record.
 *
 * Each item is a flex box, so every item is its chip's height and they share
 * one centre line (B-1021: an inline chip sat in its item's text line box, a
 * line taller than the chip and off its centre). Add tag is in the chips' own
 * wrap, so it follows the last chip on its line rather than dropping below
 * every chip as a box of its own.
 */
export function TagChips({
  tags,
  max,
  className = "",
  onRemove,
  onMore,
  add,
}: {
  tags: readonly ChipTag[] | undefined;
  max?: number | null;
  className?: string;
  onRemove?: (tag: ChipTag) => void;
  onMore?: () => void;
  add?: ReactNode;
}) {
  if (!tags?.length) return add ? <div className="flex">{add}</div> : null;
  const { shown, more } = max === null ? { shown: tags, more: 0 } : chipSplit(tags, max);
  const moreLabel = more === 1 ? "1 more tag" : `${more} more tags`;
  // Add tag's wider gap (10px, not the chips' 4px, so a tap meant for one doesn't hit the other) is
  // the last item's own right padding, not Add tag's left margin: a margin went with it when it
  // wrapped, so it started 6px in from the chips' left edge (B-1023); the padding stays behind at
  // the end of the line above. Padding, not a margin, so the item stays inside `max-w-full`.
  const beforeAdd = add ? "pr-1.5" : "";
  return (
    <ul className={`flex flex-wrap items-center gap-1 ${className}`} aria-label="Tags" data-tag-chips="">
      {shown.map((t, i) => {
        const fill = tagColorClass(t.color);
        const last = i === shown.length - 1 && more === 0;
        return (
          <li key={t.id} className={`flex max-w-full ${last ? beforeAdd : ""}`}>
            <Badge
              className={`max-w-full ${onRemove ? "gap-0.5 pr-0.5" : ""}`}
              fill={fill}
              data-tag-chip={t.id}
              data-tag-color={fill ? (t.color ?? undefined) : undefined}
            >
              <span className="truncate">{t.name}</span>
              {onRemove && (
                <button
                  type="button"
                  aria-label={`Remove tag ${t.name}`}
                  title={`Remove tag ${t.name}`}
                  onClick={() => onRemove(t)}
                  // A small mark close to the name, with a 32px hit area around it, for one tap.
                  className="hover:bg-base-content/15 focus-visible:outline-base-content relative grid size-3.5 shrink-0 cursor-pointer place-items-center rounded-full focus-visible:outline-2 after:absolute after:-inset-[9px] after:content-['']"
                  data-tag-remove={t.id}
                >
                  <X aria-hidden="true" className="size-3" />
                </button>
              )}
            </Badge>
          </li>
        );
      })}
      {more > 0 && (
        <li className={`flex ${beforeAdd}`}>
          {onMore ? (
            <button
              type="button"
              onClick={onMore}
              aria-haspopup="dialog"
              className="focus-visible:outline-base-content flex cursor-pointer rounded-full focus-visible:outline-2"
              data-tag-more-open=""
            >
              <Badge data-tag-more="">
                <span aria-hidden="true">+{more}</span>
                <span className="sr-only">{moreLabel}</span>
              </Badge>
            </button>
          ) : (
            <Badge data-tag-more="">
              <span aria-hidden="true">+{more}</span>
              <span className="sr-only">{moreLabel}</span>
            </Badge>
          )}
        </li>
      )}
      {add && <li className="flex">{add}</li>}
    </ul>
  );
}
