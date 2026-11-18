import type { TimelineEntryKind } from "@caretook/data/schema";

import { Link, useLocation } from "react-router";
import { KIND_META } from "~/lib/entryDisplay";
import { setKind } from "~/lib/timelineFilters";

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
  const { Icon, iconClass, label } = KIND_META[kind];
  const box = size === "sm" ? "size-6" : "size-8";
  return (
    <span
      className={`${box} ${iconClass} inline-flex shrink-0 items-center justify-center rounded-full`}
      aria-hidden="true"
      title={title ?? label}
    >
      <Icon className={size === "sm" ? "size-3.5" : "size-4"} strokeWidth={2.25} />
    </span>
  );
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

/** The author's initials in a small circle, with the full name for screen readers and on hover. */
export function AuthorInitials({ name, initials }: { name: string; initials: string }) {
  return (
    <span
      title={name}
      className="bg-base-200 text-base-content/80 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-semibold"
    >
      <span aria-hidden="true">{initials}</span>
      <span className="sr-only">By {name}</span>
    </span>
  );
}
