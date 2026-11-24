import type { TimelineEntryKind } from "@caretook/data/schema";
import type { Ref } from "react";
import type { TitleState } from "./entryPage";

import { useState } from "react";
import { EntryTitle } from "./EntryHeader";
import { showTitleChips } from "./entryPage";
import { EventTitleChips } from "./EventTitleChips";

/**
 * The header's title region: the editable title (with suggested names while
 * an event is unnamed and nothing is typed), or the heading as plain text.
 */
export function EntryTitleRegion({
  state,
  heading,
  kind,
  title,
  groupId,
  inputRef,
  onCommit,
  onPick,
  onTextChange,
}: {
  state: TitleState;
  heading: string;
  kind: TimelineEntryKind;
  title: string | null;
  groupId: string;
  /** The title input, for the page to focus. */
  inputRef?: Ref<HTMLInputElement>;
  onCommit: (title: string) => void;
  /** A suggested name was chosen. */
  onPick: (title: string) => void;
  /** The title field's text as it's typed (before it's committed). */
  onTextChange?: (text: string) => void;
}) {
  const [typed, setTyped] = useState("");

  if (!state.editable) {
    return (
      <p aria-hidden="true" className="text-xl font-semibold break-words">
        {heading}
      </p>
    );
  }
  return (
    <>
      <EntryTitle
        value={state.value}
        placeholder={state.placeholder}
        inputRef={inputRef}
        onCommit={onCommit}
        onTextChange={(text) => {
          setTyped(text);
          onTextChange?.(text);
        }}
      />
      {showTitleChips({ editable: true, kind, title, typed }) && (
        <EventTitleChips groupId={groupId} onPick={onPick} />
      )}
    </>
  );
}
