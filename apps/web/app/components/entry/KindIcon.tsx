import type { TimelineEntryKind } from "@caretook/data/schema";

import { Link, useLocation } from "react-router";
import { MemberAvatar } from "~/components/members";
import { IconChip } from "~/components/ui";
import { Tooltip } from "~/components/ui/tooltip";
import { KIND_META } from "~/lib/timeline/entryDisplay";
import { setAuthor, setKind } from "~/lib/timeline/timelineFilters";

/** A round icon for an entry's kind. Decorative: the kind is also given as text. */
export function KindIcon({
  kind,
  size = "md",
  title,
}: {
  kind: TimelineEntryKind;
  size?: "sm" | "md";
  /** The hover text, when the icon is inside a control that does something. Default: the kind. */
  title?: string;
}) {
  const { Icon, accent, look, label } = KIND_META[kind];
  return <IconChip icon={Icon} accent={accent} look={look} size={size} title={title ?? label} />;
}

/**
 * An entry's kind icon as a filter: a link that shows only that kind, the
 * same as its chip. It sits above the row's open target (`relative z-10`),
 * so a tap on it filters and a tap anywhere else opens the entry. When that
 * kind is already showing, the link goes where you already are.
 */
export function KindFilterLink({ kind, size = "md" }: { kind: TimelineEntryKind; size?: "sm" | "md" }) {
  const { search } = useLocation();
  const label = `Show only ${KIND_META[kind].plural.toLowerCase()}`;
  return (
    <Link
      to={{ search: setKind(search, kind) }}
      replace
      preventScrollReset
      aria-label={label}
      className="focus-visible:outline-primary relative z-10 inline-flex shrink-0 rounded-full hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <KindIcon kind={kind} size={size} title={label} />
    </Link>
  );
}

const AUTHOR_FOCUS =
  "focus-visible:outline-primary relative z-10 focus-visible:outline-2 focus-visible:outline-offset-2";

/**
 * An entry's author as a filter: a link that shows only that person's
 * entries (`?author=`), named "Show only Alex Rivera's entries". Like the
 * kind icon it sits above the row's open target (`relative z-10`), and goes
 * where you already are when that author is already showing. With `circle`
 * it's the small avatar a row shows, with a tooltip (their avatar and full
 * name) on hover and keyboard focus; without, the name as text (a card's
 * footer), which needs no tooltip.
 */
export function AuthorFilterLink({
  userId,
  name,
  circle,
  image,
}: {
  userId: string;
  name: string;
  circle?: boolean;
  /** Their picture, for the circle and the tooltip. */
  image?: string | null;
}) {
  const { search } = useLocation();
  const link = {
    to: { search: setAuthor(search, userId) },
    replace: true,
    preventScrollReset: true,
    "aria-label": `Show only ${name}'s entries`,
    "data-author": userId,
  };
  if (!circle) {
    return (
      <Link {...link} className={`${AUTHOR_FOCUS} rounded-sm hover:underline`}>
        {name}
      </Link>
    );
  }
  return (
    <Tooltip
      content={
        <span className="flex items-center gap-2" data-author-tooltip={userId}>
          <MemberAvatar userId={userId} name={name} image={image} size="sm" />
          <span className="font-medium">{name}</span>
        </span>
      }
    >
      <Link {...link} className={`${AUTHOR_FOCUS} inline-flex shrink-0 rounded-full hover:brightness-95`}>
        <MemberAvatar userId={userId} name={name} image={image} size="row" />
      </Link>
    </Tooltip>
  );
}

/**
 * An entry's author where they aren't a filter (easy mode, the easy roles):
 * the same avatar with no link, so a tap on it opens the row. `label` is what
 * a screen reader hears.
 */
export function AuthorCircle({
  userId,
  name,
  image,
  label,
  title,
}: {
  userId: string;
  name: string;
  image?: string | null;
  label: string;
  title?: string;
}) {
  return (
    <span className="inline-flex shrink-0" title={title} data-author={userId}>
      <MemberAvatar userId={userId} name={name} image={image} size="row" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
