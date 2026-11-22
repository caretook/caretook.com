import type { Route } from "./+types/route";

import { Clock, Plus } from "lucide-react";
import { useMemo } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { Page, PageHeader, TabNav } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import { MEDICATION_SHEET_STATE, medicationTabOf } from "~/lib/medications/medicationSheets";
import { PrintMenu } from "./PrintMenu";

// Shared by web + native. The Medications page's frame: one header (the
// title, Add for writers, Passes on Schedule, Print) over two tabs, each its
// own route with its own loader and live queries: Schedule (`schedule/`,
// today's doses) and the list (`list/`, the allergies, search, filters and
// every medication). The add, edit and allergies sheets open over either tab
// (their children). Plain `medications` has no tab of its own: every link
// goes to one.

export const meta = () => [{ title: "Medications · Caretook" }];

export default function Medications({ params }: Route.ComponentProps) {
  const group = useGroup();
  const { pathname, search } = useLocation();
  const tab = medicationTabOf(params.groupId, pathname);
  const tabs = useMemo(
    () => [
      { label: "Schedule", to: appUrls.medicationSchedule(params.groupId) },
      { label: "Medications", to: appUrls.medicationList(params.groupId) },
    ],
    [params.groupId],
  );

  return (
    <Page>
      <PageHeader
        title="Medications"
        actions={
          <>
            {group.canWrite && (
              <Link
                // Over the tab you're on, which it closes back to (the list's search kept).
                to={appUrls.newMedication(params.groupId, tab ?? "list", search)}
                state={MEDICATION_SHEET_STATE}
                // Loaded ahead, so the sheet opens offline too.
                prefetch="render"
                preventScrollReset
                aria-label="Add medication"
                title="Add medication"
                className="btn btn-primary btn-sm btn-square"
                data-add-medication
              >
                <Plus className="size-4" aria-hidden="true" />
              </Link>
            )}
            {tab === "schedule" && (
              <Link
                to={appUrls.medicationPasses(params.groupId)}
                prefetch="render"
                className="btn btn-ghost btn-sm gap-1.5"
                data-passes-link
              >
                <Clock className="size-4" aria-hidden="true" />
                Passes
              </Link>
            )}
            <PrintMenu groupId={params.groupId} />
          </>
        }
      />

      <TabNav label="Medications tabs" tabs={tabs} />

      {/* The tab, and any sheet over it. */}
      <Outlet />
    </Page>
  );
}
