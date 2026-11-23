import type { TodayCardData } from "./useTodayCard";

import { CheckCheck, Pill } from "lucide-react";
import { Link, useLocation } from "react-router";
import { PassUndoStatus, usePassLog } from "~/components/medications";
import { Button, LINK, Message } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { givenAllLabel, scheduleZoneNote } from "~/lib/medications/medicationDisplay";
import { medicationStripText } from "~/lib/medications/medicationStrip";
import { SHEET_LINK_STATE } from "./sheet";
import { TodayRow, TodayRowSkeleton } from "./TodayRow";

const deviceZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * The Today card's medications row (B-86's strip, moved): there while the
 * group has scheduled medications. "Next: Evening · 20:00 · 4 meds" until a
 * pass is due; then "Due: …" with **Given all** for writers, and "Overdue: …"
 * (an overdue earlier pass takes the row). For writers the pass's name opens
 * the Dose sheet on that pass (filters kept); Given all logs every open
 * medication in it and offers Undo below. Viewers get the text only.
 * Remembered from earlier this session, it's dimmed with Given all off until
 * the device confirms it; on a first visit a skeleton holds its place.
 */
export function TodayMedicationsRow({
  groupId,
  canWrite,
  medications,
  status,
}: {
  groupId: string;
  canWrite: boolean;
  medications: TodayCardData["medications"];
  status: TodayCardData["status"]["medications"];
}) {
  const { strip, ready, fresh, timeZone } = medications;
  const { search } = useLocation();
  const { givenAll, busy, error } = usePassLog(groupId);
  if (!ready) return <TodayRowSkeleton row="medications" />;
  if (!strip) return null;

  const { state, pass, tomorrow } = strip;
  const { lead, title, rest, text } = medicationStripText(strip);
  const zoneNote = scheduleZoneNote(timeZone, deviceZone());
  const dueNow = state !== "next";

  return (
    <TodayRow
      row="medications"
      status={status}
      Icon={Pill}
      stale={!fresh}
      seeAll={appUrls.medicationSchedule(groupId)}
      seeAllLabel="See all medications"
      action={
        canWrite &&
        dueNow && (
          <Button
            variant={state === "overdue" ? "danger" : "warning"}
            size="xs"
            icon={CheckCheck}
            className="shrink-0"
            disabled={busy || !fresh}
            aria-label={givenAllLabel(pass)}
            data-given-all=""
            onClick={() => void givenAll(pass)}
          >
            Given all
          </Button>
        )
      }
      below={
        <>
          {error && (
            <Message tone="error" className="px-3 pb-1">
              {error}
            </Message>
          )}
          <PassUndoStatus groupId={groupId} className="not-empty:px-3 not-empty:pb-2" />
        </>
      }
    >
      <span
        data-med-pass={tomorrow ? undefined : pass.key}
        data-med-state={state}
        title={zoneNote ? `${text} · ${zoneNote}` : text}
      >
        <span className={dueNow ? "font-semibold" : "text-muted"}>{lead}:</span>{" "}
        {canWrite && !tomorrow ? (
          <Link
            to={appUrls.newDose(
              groupId,
              pass.passId
                ? { passId: pass.passId, search }
                : {
                    medicationId: pass.open[0]?.medication.id ?? pass.slots[0]?.medication.id,
                    slot: pass.time,
                    search,
                  },
            )}
            state={SHEET_LINK_STATE}
            preventScrollReset
            prefetch="render"
            className={`${LINK} font-medium`}
            aria-label={`${title}: open the Dose sheet`}
            data-med-open
          >
            {title}
          </Link>
        ) : (
          <span className="font-medium">{title}</span>
        )}
        <span> · {rest}</span>
        {zoneNote && <span className="text-faint"> · {zoneNote}</span>}
      </span>
    </TodayRow>
  );
}
