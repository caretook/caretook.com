import type { NoteSectionLine } from "@caretook/data/schema";
import type { VisitPrepTarget } from "./useVisitPrep";

import { useState } from "react";
import { useNavigate } from "react-router";
import { Button, Loading, Message, Sheet } from "~/components/ui";
import { DateTimeField } from "~/components/ui/date";
import { appUrls } from "~/lib/app-shell/appUrls";
import { dateText } from "~/lib/care-periods/periodDisplay";
import { upcomingTitle } from "~/lib/appointments/upcomingLabels";
import { useVisitPrepPreview } from "./useVisitPrepPreview";

/**
 * Preparing for a visit: where the window starts (the last visit with the
 * appointment's providers, else 30 days back; editable), a preview of the
 * section, and Insert, which puts it at the top of the appointment's live
 * notes. Everything is local, so it works offline.
 */
export function VisitPrepSheet({
  target,
  groupId,
  openAfter,
  onClose,
}: {
  target: VisitPrepTarget;
  groupId: string;
  /** Open the appointment's page once it's in. */
  openAfter: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const prep = useVisitPrepPreview(groupId, target.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const title = upcomingTitle({ kind: "event", title: target.title });
  const { found, timeZone } = prep;

  const insert = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const problem = await prep.insert();
    setBusy(false);
    if (problem) return setError(problem);
    onClose();
    if (openAfter) void navigate(appUrls.entry(groupId, target.id));
  };

  return (
    <Sheet guardChanges isOpen onOpenChange={(open) => !open && onClose()} title={`Prepare for ${title}`}>
      <form
        className="space-y-3"
        data-visit-prep-sheet=""
        onSubmit={(e) => {
          e.preventDefault();
          void insert();
        }}
      >
        {found && timeZone ? (
          <>
            <p className="text-muted text-sm" data-visit-window>
              {found.lastVisit
                ? `From the last visit: ${upcomingTitle({ kind: "event", title: found.lastVisit.title })}, ${dateText(found.lastVisit.occurredAt, timeZone, prep.now)}.`
                : "No earlier visit with these providers: the last 30 days."}
            </p>
            <DateTimeField
              label="Start from"
              required
              defaultValue={found.from}
              max={prep.now.toISOString()}
              timeZone={timeZone}
              onChange={(iso) => {
                prep.setFrom(iso);
                setError(null);
              }}
            />
          </>
        ) : (
          <Loading label="Reading what happened…" />
        )}

        <section
          aria-labelledby="visit-prep-preview"
          className="rounded-box border-base-300 bg-base-200/40 max-h-[50vh] overflow-y-auto border p-3"
          data-visit-prep-preview=""
        >
          <h3 id="visit-prep-preview" className="text-muted mb-1 text-xs font-semibold uppercase">
            Preview
          </h3>
          {prep.lines ? <SectionPreview lines={prep.lines} /> : <p className="text-sm">…</p>}
        </section>

        <p className="text-muted text-sm">
          It goes at the top of the notes, dated. Nothing already there changes.
        </p>
        {error && <Message tone="error">{error}</Message>}
        <Button
          type="submit"
          variant="primary"
          block
          busy={busy}
          busyLabel="Inserting…"
          disabled={!prep.lines}
        >
          Insert into the notes
        </Button>
      </form>
    </Sheet>
  );
}

/** The section's lines as they'll read in the notes: the heading, subheadings and their bullets. */
function SectionPreview({ lines }: { lines: NoteSectionLine[] }) {
  const blocks: { key: number; line: NoteSectionLine; bullets: string[] }[] = [];
  for (const [i, line] of lines.entries()) {
    const last = blocks.at(-1);
    if (line.style === "bullet" && last) last.bullets.push(line.text);
    else blocks.push({ key: i, line, bullets: [] });
  }
  return (
    <div className="space-y-1.5 text-sm">
      {blocks.map(({ key, line, bullets }) => (
        <div key={key}>
          {line.style === "heading" ? (
            <p className="font-semibold">{line.text}</p>
          ) : line.style === "subheading" ? (
            <p className="font-medium">{line.text}</p>
          ) : (
            <p>{line.text}</p>
          )}
          {bullets.length > 0 && (
            <ul className="list-disc ps-5">
              {bullets.map((text, i) => (
                <li key={i}>{text}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
