import type { ReactNode } from "react";
import type { TitleState } from "./entryPage";
import type { LiveEntry } from "./useLiveEntry";

import { useState } from "react";
import { EntryActions } from "~/components/entry";
import { ConfirmDialog } from "~/components/ui";
import { appUrls } from "~/lib/appUrls";
import { KIND_META } from "~/lib/entryDisplay";
import { EntryHeader, EntryTime } from "./EntryHeader";
import { EntryTimeChip } from "./EntryTimeChip";
import { EntryTitleRegion } from "./EntryTitleRegion";
import { EntryWithRow } from "./EntryWithRow";
import { ShareButton } from "./ShareButton";

/**
 * The entry page's header, filled from its live entry: the title, when it
 * happened (a chip for writers), who's writing, and, once there's an entry to
 * link to, Share for everyone and the ⋯ menu (Delete, confirmed) for writers;
 * and who it was with (providers).
 */
export function EntryPageHeader({
  live,
  groupId,
  heading,
  title,
  onPickTitle,
  editors,
}: {
  live: LiveEntry;
  groupId: string;
  heading: string;
  title: TitleState;
  /** A suggested title was chosen. */
  onPickTitle: (title: string) => void;
  editors: ReactNode;
}) {
  const { entry, canWrite, deleted, stored } = live;
  const noun = KIND_META[entry.kind].label.toLowerCase();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <>
      <EntryHeader
        kind={entry.kind}
        title={
          <EntryTitleRegion
            state={title}
            heading={heading}
            kind={entry.kind}
            title={entry.title}
            groupId={groupId}
            onCommit={live.commitTitle}
            onPick={onPickTitle}
          />
        }
        time={
          canWrite && !deleted ? (
            <EntryTimeChip occurredAt={entry.occurredAt} onChange={live.changeTime} />
          ) : (
            <>
              <EntryTime occurredAt={entry.occurredAt} />
              {!canWrite && " · You can view this"}
            </>
          )
        }
        actions={
          stored && (
            <>
              <ShareButton title={heading} path={appUrls.entry(groupId, entry.id)} />
              {canWrite && (
                <EntryActions
                  kind={entry.kind}
                  label={`Actions for this ${noun}`}
                  onDelete={() => setConfirmDelete(true)}
                />
              )}
            </>
          )
        }
        editors={editors}
        with={
          !deleted && (
            <EntryWithRow
              entryId={entry.id}
              groupId={groupId}
              canWrite={canWrite}
              ensureStored={live.ensureStored}
            />
          )
        }
      />
      <ConfirmDialog
        open={confirmDelete}
        title={`Delete this ${noun}?`}
        confirmLabel="Delete"
        onConfirm={() => {
          setConfirmDelete(false);
          void live.remove();
        }}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  );
}
