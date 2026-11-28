import type { ReactNode } from "react";

import { CalendarClock, CheckCheck } from "lucide-react";
import { useMemo } from "react";
import { PassUndoStatus, usePassLog } from "~/components/medications";
import { Button, ICON_LG, Message, Skeleton } from "~/components/ui";
import { useDueDoses } from "~/lib/medications/dueDoses.sync";
import { EASY_BLOCK, EASY_HEADING, STALE } from "./layout";
import { duePasses, isPassDueNow, givePassText, medicationCountText, passTitle } from "@caretook/data/schema";

/** Where the Upcoming block's Undo is shown (`PassUndoStatus`'s `place`). */
export const EASY_NOW_UNDO = "easyNow";

/**
 * Easy mode's Upcoming block (assistant PRD): what needs doing. Each pass due
 * now (named or a time of its own) as one big Given all button ("Give
 * evening meds (4)"), with Undo for about 10 s, as on the medication strip;
 * then `next` (the next appointment, given by the caller: `EasyNext`, which
 * opens the next five). Viewers get the due passes as text and no Given all. Nothing at all when nothing is due and
 * there's no `next`. Local data, so it works offline.
 *
 * It never pops in (the tile cache): passes remembered from earlier this
 * session paint at once, dimmed (`data-stale`, buttons off) until the
 * device confirms them; on a first visit a skeleton holds their place.
 */
export function EasyNow({
  groupId,
  canWrite,
  next,
  className = "",
}: {
  groupId: string;
  canWrite: boolean;
  next?: ReactNode;
  className?: string;
}) {
  const { due, ready, fresh, passes } = useDueDoses(groupId);
  const dueNow = useMemo(
    () => (ready ? duePasses(due, passes).filter(isPassDueNow) : []),
    [due, ready, passes],
  );
  const { givenAll, busy, error } = usePassLog(groupId);

  // The Undo line stays mounted while a round was just logged, even once nothing is due.
  if (ready && !dueNow.length && !next && !canWrite) return null;
  const stale = fresh ? "" : STALE;
  // A card only while it shows something (an Undo line alone stays plain).
  const shows = dueNow.length > 0 || !!next || !ready;
  return (
    <section
      aria-label="Upcoming"
      className={`space-y-3 ${shows ? EASY_BLOCK : ""} ${className}`}
      data-easy-now=""
    >
      {shows && (
        <h2 className={EASY_HEADING}>
          <CalendarClock aria-hidden="true" className={`text-primary ${ICON_LG}`} />
          Upcoming
        </h2>
      )}
      {!ready && (
        <div className="h-16" aria-hidden="true" data-easy-skeleton="now">
          <Skeleton lines={3} />
        </div>
      )}
      {dueNow.length > 0 &&
        (canWrite ? (
          <ul className={`space-y-2 ${stale}`} aria-label="Due now" data-stale={fresh ? undefined : ""}>
            {dueNow.map((pass) => (
              <li key={pass.key}>
                <Button
                  variant={pass.state === "overdue" ? "danger" : "warning"}
                  size="lg"
                  block
                  icon={CheckCheck}
                  className="justify-start text-xl"
                  disabled={busy || !fresh}
                  data-easy-give={pass.key}
                  onClick={() => void givenAll(pass, { place: EASY_NOW_UNDO })}
                >
                  {givePassText(pass)}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <ul
            className={`space-y-1 text-xl ${stale}`}
            aria-label="Due now"
            data-stale={fresh ? undefined : ""}
          >
            {dueNow.map((pass) => (
              <li key={pass.key} data-easy-due={pass.key}>
                {pass.state === "overdue" ? "Overdue" : "Due now"}: {passTitle(pass)} ·{" "}
                {medicationCountText(pass.open.length)}
              </li>
            ))}
          </ul>
        ))}
      {canWrite && <PassUndoStatus groupId={groupId} place={EASY_NOW_UNDO} className="text-base" />}
      <Message tone="error" className="text-base!">
        {error}
      </Message>
      {next}
    </section>
  );
}
