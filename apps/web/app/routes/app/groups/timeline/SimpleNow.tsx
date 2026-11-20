import type { ReactNode } from "react";

import { CheckCheck } from "lucide-react";
import { useMemo } from "react";
import { PassUndoStatus, usePassLog } from "~/components/medications";
import { duePasses, isPassDueNow } from "~/lib/medications/duePasses";
import { givePassText, medicationCountText, passTitle } from "~/lib/medications/medicationDisplay";
import { useDueDoses } from "~/lib/medications/dueDoses.sync";
import { STALE } from "./layout";

/** Where the Now block's Undo is shown (`PassUndoStatus`'s `place`). */
export const SIMPLE_NOW_UNDO = "simpleNow";

/**
 * Simple mode's Now block (assistant PRD): what needs doing. Each pass due
 * now (named or a time of its own) as one big Given all button ("Give
 * evening meds (4)"), with Undo for about 10 s, as on the medication strip;
 * then `next` (the next appointment, given by the caller). Viewers get the
 * due passes as text and no buttons. Nothing at all when nothing is due and
 * there's no `next`. Local data, so it works offline.
 *
 * It never pops in (the tile cache): passes remembered from earlier this
 * session paint at once, dimmed (`data-stale`, buttons off) until the
 * device confirms them; on a first visit a skeleton holds their place.
 */
export function SimpleNow({
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
  return (
    <section aria-label="Now" className={`space-y-3 ${className}`} data-simple-now="">
      {(dueNow.length > 0 || next || !ready) && <h2 className="text-2xl font-semibold">Now</h2>}
      {!ready && <div className="skeleton rounded-box h-14" aria-hidden="true" data-simple-skeleton="now" />}
      {dueNow.length > 0 &&
        (canWrite ? (
          <ul className={`space-y-2 ${stale}`} aria-label="Due now" data-stale={fresh ? undefined : ""}>
            {dueNow.map((pass) => (
              <li key={pass.key}>
                <button
                  type="button"
                  className={`btn btn-lg w-full justify-start text-xl ${pass.state === "overdue" ? "btn-error" : "btn-warning"}`}
                  disabled={busy || !fresh}
                  data-simple-give={pass.key}
                  onClick={() => void givenAll(pass, { place: SIMPLE_NOW_UNDO })}
                >
                  <CheckCheck aria-hidden="true" className="size-6" />
                  {givePassText(pass)}
                </button>
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
              <li key={pass.key} data-simple-due={pass.key}>
                {pass.state === "overdue" ? "Overdue" : "Due now"}: {passTitle(pass)} ·{" "}
                {medicationCountText(pass.open.length)}
              </li>
            ))}
          </ul>
        ))}
      {canWrite && <PassUndoStatus groupId={groupId} place={SIMPLE_NOW_UNDO} className="text-base" />}
      {error && <p className="text-error text-base">{error}</p>}
      {next}
    </section>
  );
}
