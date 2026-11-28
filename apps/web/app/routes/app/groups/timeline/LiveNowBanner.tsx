import type { LiveDocument } from "~/lib/live-notes/liveNow";

import { useState } from "react";
import { Button } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { announcementText, writingLabel } from "~/lib/live-notes/liveNow";
import { COLUMN_CAP } from "./layout";
import { LiveDot } from "~/components/entry";

/**
 * "Maria is writing · PT visit · Join": the most recently active note or
 * event that other members are writing in now (`documents`, most recent
 * first), with "+N more" for the rest. Join opens it. Screen readers hear
 * one polite announcement per document, however its editors or the count
 * change afterwards.
 */
export function LiveNowBanner({
  documents,
  groupId,
  nameOf,
}: {
  documents: LiveDocument[];
  groupId: string;
  nameOf: (userId: string) => string;
}) {
  const top = documents[0];

  // Announce each document once: when it first becomes the banner's.
  const [announced, setAnnounced] = useState<{ ids: string[]; text: string }>({ ids: [], text: "" });
  if (top && !announced.ids.includes(top.id))
    setAnnounced({ ids: [...announced.ids, top.id], text: announcementText(top, nameOf) });
  else if (!top && announced.text) setAnnounced({ ...announced, text: "" });

  const more = documents.length - 1;
  return (
    <>
      <p role="status" className="sr-only">
        {announced.text}
      </p>
      {top && (
        <section
          aria-label="Live now"
          data-live-banner={top.id}
          className={`rounded-box border-primary/30 bg-primary/10 flex items-center gap-2.5 border px-3 py-2 ${COLUMN_CAP}`}
        >
          <LiveDot />
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-semibold">{writingLabel(top.editors.map((e) => nameOf(e.userId)))}</span>
            <span className="text-muted"> · </span>
            <span className="break-words">{top.title}</span>
            {more > 0 && <span className="text-muted"> · +{more} more</span>}
          </p>
          <Button
            to={appUrls.entry(groupId, top.id)}
            variant="primary"
            size="sm"
            className="shrink-0"
            aria-label={`Join ${top.title}`}
          >
            Join
          </Button>
        </section>
      )}
    </>
  );
}
