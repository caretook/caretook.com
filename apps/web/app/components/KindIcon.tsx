import type { TimelineEntryKind } from "@caretook/data/schema";

import { KIND_META } from "~/lib/entryDisplay";

/** A round icon for an entry's kind. Decorative: the kind is also given as text. */
export function KindIcon({ kind, size = "md" }: { kind: TimelineEntryKind; size?: "sm" | "md" }) {
  const { Icon, iconClass, label } = KIND_META[kind];
  const box = size === "sm" ? "size-6" : "size-8";
  return (
    <span
      className={`${box} ${iconClass} inline-flex shrink-0 items-center justify-center rounded-full`}
      aria-hidden="true"
      title={label}
    >
      <Icon className={size === "sm" ? "size-3.5" : "size-4"} strokeWidth={2.25} />
    </span>
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
