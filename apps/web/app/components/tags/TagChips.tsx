import { Badge } from "~/components/ui";
import { chipSplit } from "~/lib/tags/tagPicker";

/**
 * A record's tags as small chips: on rows the first two, then "+N"
 * (`chipSplit`); `max` null shows them all (a record's own page). Nothing
 * when it has none. Every role sees them.
 */
export function TagChips({
  tags,
  max,
  className = "",
}: {
  tags: readonly { id: string; name: string }[] | undefined;
  max?: number | null;
  className?: string;
}) {
  if (!tags?.length) return null;
  const { shown, more } = max === null ? { shown: tags, more: 0 } : chipSplit(tags, max);
  return (
    <ul className={`flex flex-wrap items-center gap-1 ${className}`} aria-label="Tags" data-tag-chips="">
      {shown.map((t) => (
        <li key={t.id} className="max-w-full">
          <Badge className="max-w-full" data-tag-chip={t.id}>
            <span className="truncate">{t.name}</span>
          </Badge>
        </li>
      ))}
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
