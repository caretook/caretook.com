import type { Route } from "./+types/route";

import { useMemo } from "react";
import { Outlet, PrefetchPageLinks, useLocation } from "react-router";
import { Page, PageHeader, TabNav } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import { sectionAccent } from "~/lib/app-shell/sectionAccents";
import { medicationTabOf } from "~/lib/medications/medicationSheets";
import { PrintMenu } from "./PrintMenu";
import { useAddMenu } from "./useAddMenu";

// Shared by web + native. The Medications page's frame: one header (the
// title, Print, and for writers the `+` menu: Medication, Pass) over three
// tabs, each its own route with its own loader and live queries: Schedule
// (`schedule/`, today's doses), the list (`list/`, the allergies, search,
// filters and every medication) and Passes (`passes/`, the group's rounds).
// The add, edit and allergies sheets open over Schedule or the list (their
// children), the add-pass sheet over Passes. Plain `medications` has no tab
// of its own: every link goes to one.

export const meta = () => [{ title: "Medications · Caretook" }];

export default function Medications({ params }: Route.ComponentProps) {
  const group = useGroup();
  const section = sectionAccent("medications", { easy: group.easyRole });
  const { pathname, search } = useLocation();
  const add = useAddMenu(params.groupId, medicationTabOf(params.groupId, pathname), search);
  const tabs = useMemo(
    () => [
      { label: "Schedule", to: appUrls.medicationSchedule(params.groupId) },
      { label: "Medications", to: appUrls.medicationList(params.groupId) },
      { label: "Med times", to: appUrls.medicationPasses(params.groupId) },
    ],
    [params.groupId],
  );

  return (
    <Page>
      <PageHeader
        title="Medications"
        {...section}
        actions={<PrintMenu groupId={params.groupId} />}
        add={
          group.canWrite && { label: "Add", menuLabel: "Add", items: add.items, "data-add-medication": "" }
        }
      />
      {/* The sheets' modules, loaded ahead, so they open offline too. */}
      {group.canWrite && add.prefetch.map((page) => <PrefetchPageLinks key={page} page={page} />)}

      <TabNav label="Medications tabs" tabs={tabs} accent={section?.accent} />

      {/* The tab, and any sheet over it. */}
      <Outlet />
    </Page>
  );
}
