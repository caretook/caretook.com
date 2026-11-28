import type { ReactNode } from "react";

import { Link } from "react-router";
import { ListRow } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useMedicationLinkState } from "~/lib/medications/medicationOrigin";
import { medicationTitle } from "@caretook/data/schema";
import { MedicationIcon } from "./MedicationIcon";

type DataHooks = { [attr: `data-${string}`]: string | undefined };

/** The name stretched over the card, so a tap anywhere opens it (the card is `relative isolate`). */
const STRETCHED =
  "min-w-0 font-medium wrap-break-word outline-none before:absolute before:inset-0 focus-visible:before:outline-2 focus-visible:before:-outline-offset-2";
/** A card that opens: a quiet fill on hover, deeper while pressed. */
const OPENS =
  "motion-colors hover:bg-base-200 has-[a:active]:bg-base-300/60 has-[button[data-opens-sheet]:active]:bg-base-300/60";

/**
 * One medication as a row of a `List`, the same everywhere it's shown (the
 * list, Schedule, a provider's page, search): its icon (`MedicationIcon`),
 * `label` as a quiet line above the name ("Prescribes"), its name and
 * strength (`title` in its place: search's marked name), `badge` at the
 * name's right edge (a state or a type), `children` as the quiet lines under
 * it, `actions` (Given, Log, a menu) and `trailing` (a link's Remove) above
 * the stretched name so a tap on them never opens it, and `notes` (a double
 * dose, an error) across the foot. A stopped one is muted.
 *
 * `open` says how it opens: left out, the whole card links to its page
 * (carrying where it was opened from); a callback, the name is a button
 * (`data-opens-sheet`; the easy roles' read-only sheet); `null`, a plain
 * name that opens nothing. A `removed` one is greyed "<name> (removed)",
 * with no link, badge or actions (`trailing` stays, so a link to it can
 * still be removed).
 */
export function MedicationCard({
  medication,
  groupId,
  stopped = false,
  removed = false,
  title,
  open,
  label,
  badge,
  actions,
  trailing,
  notes,
  children,
  ...data
}: {
  medication: { id: string; name: string; strength: string | null };
  groupId: string;
  stopped?: boolean;
  removed?: boolean;
  /** In place of the name and strength (search's marked name). */
  title?: ReactNode;
  open?: (() => void) | null;
  /** A quiet line above the name. */
  label?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  trailing?: ReactNode;
  notes?: ReactNode;
  children?: ReactNode;
} & DataHooks) {
  const linkState = useMedicationLinkState();
  const muted = stopped || removed;
  const opens = !removed && open !== null;
  const name = title ?? medicationTitle(medication);
  const nameClass = `${opens ? STRETCHED : "min-w-0 font-medium wrap-break-word"} ${removed ? "text-faint" : muted ? "text-muted" : ""}`;
  return (
    <ListRow
      className={`relative isolate flex flex-wrap items-start gap-x-3 gap-y-1 ${opens ? OPENS : ""}`}
      data-removed={removed ? "" : undefined}
      {...data}
    >
      <MedicationIcon muted={muted} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        {label && (
          <p className="text-muted text-xs" data-medication-label="">
            {label}
          </p>
        )}
        <p className="flex min-w-0 items-start justify-between gap-2">
          {removed ? (
            <span className={nameClass} data-medication-name>
              {name} (removed)
            </span>
          ) : open === null ? (
            <span className={nameClass} data-medication-name>
              {name}
            </span>
          ) : open ? (
            <button
              type="button"
              onClick={open}
              className={`cursor-pointer text-left ${nameClass}`}
              data-medication-name
              data-opens-sheet
            >
              {name}
            </button>
          ) : (
            <Link
              to={appUrls.medication(groupId, medication.id)}
              state={linkState}
              className={nameClass}
              data-medication-name
            >
              {name}
            </Link>
          )}
          {!removed && badge}
        </p>
        {children}
      </div>
      {!removed && actions && (
        <div className="relative z-10 flex shrink-0 items-center gap-1 self-center" data-card-actions="">
          {actions}
        </div>
      )}
      {trailing && (
        <div className="relative z-10 flex shrink-0 items-center gap-1 self-center" data-card-trailing="">
          {trailing}
        </div>
      )}
      {notes && <div className="w-full space-y-1 pl-11">{notes}</div>}
    </ListRow>
  );
}
