import type { EntryRow } from "~/lib/timeline/timeline.sync";

import { ClipboardList } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ConfirmDialog, Section } from "~/components/ui";
import { useVisitPrep } from "~/components/visitPrep";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useLiveQuery } from "~/lib/sync";
import { useNow } from "~/lib/live-notes/editors.sync";
import { providerEventsQuery, toVisitEvents } from "~/lib/appointments/visitPrep.sync";
import { nextUp } from "~/lib/appointments/upcoming";
import { upcomingTitle, upcomingWhen } from "~/lib/appointments/upcomingLabels";

const NO_ROWS: (EntryRow & { link_provider_id: string })[] = [];
const TICK_MS = 60_000;

/**
 * "Prepare for a visit" on a provider's page (writers): it opens the visit
 * prep sheet for their next appointment (the soonest upcoming, not cancelled
 * event linked to them), then that appointment's page. With none coming up,
 * it offers to add one, with the day picked first and the provider linked.
 */
export function ProviderVisitPrep({
  groupId,
  providerId,
  providerName,
}: {
  groupId: string;
  providerId: string;
  providerName: string;
}) {
  const navigate = useNavigate();
  const query = providerEventsQuery([providerId]);
  const rows = useLiveQuery(query.sql, query.params, NO_ROWS);
  const now = useNow(TICK_MS);
  const next = useMemo(() => nextUp(toVisitEvents(rows), new Date(now)).next, [rows, now]);
  const prep = useVisitPrep(groupId, true, { openAfter: true });
  const [offer, setOffer] = useState(false);

  return (
    <Section title="Visits" id="visits">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-provider-visit-prep="">
        <button
          type="button"
          className="btn btn-outline btn-sm gap-1.5"
          data-prepare-visit=""
          onClick={() => (next ? prep.ask({ id: next.id, title: next.title }) : setOffer(true))}
        >
          <ClipboardList className="size-4" aria-hidden="true" />
          Prepare for a visit
        </button>
        {next && (
          <span className="text-base-content/70 text-sm" data-next-visit>
            Next: {upcomingTitle({ kind: "event", title: next.title })}, {upcomingWhen(next, new Date(now))}
          </span>
        )}
        {prep.sheet}
        <ConfirmDialog
          open={offer}
          title={`No visit with ${providerName} coming up`}
          message="Add the event first: pick its day, then prepare for it from its page."
          confirmLabel="Add an event"
          onClose={() => setOffer(false)}
          onConfirm={() => {
            setOffer(false);
            void navigate(appUrls.newAppointmentWith(groupId, providerId));
          }}
        />
      </div>
    </Section>
  );
}
