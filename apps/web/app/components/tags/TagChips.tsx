import { Badge, tagColorClass } from "~/components/ui";
import { chipSplit } from "~/lib/tags/tagPicker";

/**
 * A record's tags as small chips: on rows the first two, then "+N"
 * (`chipSplit`); `max` null shows them all (a record's own page). Nothing
 * when it has none. Every role sees them. Each chip takes its tag's color
 * (`tagColorClass`); a null or unknown color is the neutral chip.
 */
export function TagChips({
  tags,
  max,
  className = "",
}: {
  tags: readonly { id: string; name: string; color?: string | null }[] | undefined;
  max?: number | null;
  className?: string;
}) {
  if (!tags?.length) return null;
  const { shown, more } = max === null ? { shown: tags, more: 0 } : chipSplit(tags, max);
  return (
    <ul className={`flex flex-wrap items-center gap-1 ${className}`} aria-label="Tags" data-tag-chips="">
      {shown.map((t) => {
        const fill = tagColorClass(t.color);
        return (
          <li key={t.id} className="max-w-full">
            <Badge
              className="max-w-full"
              fill={fill}
              data-tag-chip={t.id}
              data-tag-color={fill ? (t.color ?? undefined) : undefined}
            >
              <span className="truncate">{t.name}</span>
            </Badge>
          </li>
        );
      })}
      {more > 0 && (
        <li>
          <Badge data-tag-more="">
            <span aria-hidden="true">+{more}</span>
            <span className="sr-only">{more === 1 ? "1 more tag" : `${more} more tags`}</span>
          </Badge>
        </li>
      )}
    </ul>
  );
}
