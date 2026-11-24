import type { ReactNode } from "react";

import { Pill } from "lucide-react";
import { Link } from "react-router";
import { ListRow } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useMedicationLinkState } from "~/lib/medications/medicationOrigin";
import { medicationTitle } from "~/lib/medications/medicationDisplay";

type DataHooks = { [attr: `data-${string}`]: string | undefined };

/**
 * One medication as a row of a `List`, the same on Schedule and the list:
 * the whole card opens its page (the name is a link stretched over the row,
 * carrying where it was opened from), with its name and strength, `badge`
 * at the name's right edge (a state or a type), `children` as the quiet
 * lines under it, `actions` (Given, Log, a menu) above the link so a tap on
 * them never opens the page, and `notes` (a double dose, an error) across
 * the foot. A stopped one is muted.
 */
export function MedicationCard({
  medication,
  groupId,
  stopped = false,
  badge,
  actions,
  notes,
  children,
  ...data
}: {
  medication: { id: string; name: string; strength: string | null };
  groupId: string;
  stopped?: boolean;
  badge?: ReactNode;
  actions?: ReactNode;
  notes?: ReactNode;
  children?: ReactNode;
} & DataHooks) {
  const linkState = useMedicationLinkState();
  return (
    <ListRow
      className="motion-colors hover:bg-base-200 has-[a:active]:bg-base-300/60 relative isolate flex flex-wrap items-start gap-x-3 gap-y-1"
      {...data}
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${stopped ? "bg-base-200 text-faint" : "bg-primary/15 text-primary"}`}
      >
        <Pill className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-start justify-between gap-2">
          <Link
            to={appUrls.medication(groupId, medication.id)}
            state={linkState}
            className={`min-w-0 font-medium wrap-break-word outline-none before:absolute before:inset-0 focus-visible:before:outline-2 focus-visible:before:-outline-offset-2 ${stopped ? "text-muted" : ""}`}
            data-medication-name
          >
            {medicationTitle(medication)}
          </Link>
          {badge}
        </p>
        {children}
      </div>
      {actions && <div className="relative z-10 flex shrink-0 items-center gap-1 self-center">{actions}</div>}
      {notes && <div className="w-full space-y-1 pl-11">{notes}</div>}
    </ListRow>
  );
}
