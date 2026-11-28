import type { NamedTag } from "./loadSearch";
import type { ReactNode } from "react";

import { Link } from "react-router";
import { TagChips } from "~/components/tags";
import { Highlight } from "~/components/ui";
import type { ParsedSearch, Snippet } from "@caretook/data/domain";
import { highlightRanges } from "@caretook/data/domain";

/** A link stretched over its row, so a tap anywhere opens the result (the row is `relative isolate`). */
export const STRETCHED =
  "outline-none before:absolute before:inset-0 before:rounded-[inherit] focus-visible:before:outline-2 focus-visible:before:-outline-offset-2 focus-visible:before:outline-primary";

export const ROW = "relative isolate flex items-start gap-3 px-3 py-2.5";

/**
 * A result's name, opening it: a link to its page or sheet, or, with
 * `onOpen` (the easy roles), a button opening its read-only sheet here.
 */
export function OpenName({
  to,
  state,
  onOpen,
  className,
  children,
}: {
  to: string;
  state?: unknown;
  onOpen?: () => void;
  className: string;
  children: ReactNode;
}) {
  if (onOpen)
    return (
      <button
        type="button"
        onClick={onOpen}
        className={`cursor-pointer text-left ${className}`}
        data-opens-sheet
      >
        {children}
      </button>
    );
  return (
    <Link to={to} state={state} className={className}>
      {children}
    </Link>
  );
}

/** `text` with the search's matches marked. */
export const Marked = ({ text, search }: { text: string; search: ParsedSearch }) => (
  <Highlight text={text} ranges={highlightRanges(text, search)} />
);

/** The tags the text names that a result carries (tags-3): why it's here when its text doesn't say. */
export const NamedTags = ({ tags }: { tags: readonly NamedTag[] | undefined }) => (
  <TagChips tags={tags} max={null} className="mt-1" />
);

/** A line from the notes, around the match that's only there. */
export function NotesSnippet({ snippet }: { snippet: Snippet | null }) {
  if (!snippet) return null;
  return (
    <p className="text-muted text-sm break-words" data-snippet>
      <span className="sr-only">From the notes: </span>
      <Highlight text={snippet.text} ranges={snippet.ranges} />
    </p>
  );
}
