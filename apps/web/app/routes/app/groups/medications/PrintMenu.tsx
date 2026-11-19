import { CalendarDays, List, Printer } from "lucide-react";
import { useMemo } from "react";
import { PrefetchPageLinks } from "react-router";
import { Menu } from "~/components/ui";
import { appUrls } from "~/lib/appUrls";

/**
 * The list's Print menu: the medication list, or the weekly bedside chart.
 * Both pages' modules are fetched now, so either opens offline.
 */
export function PrintMenu({ groupId }: { groupId: string }) {
  const list = appUrls.medicationsPrint(groupId);
  const week = appUrls.medicationsPrintWeek(groupId);
  const items = useMemo(
    () => [
      {
        id: "list",
        label: "Medication list",
        description: "Every medication, and who to call",
        icon: List,
        href: list,
      },
      {
        id: "week",
        label: "Weekly chart",
        description: "A box to tick for each dose",
        icon: CalendarDays,
        href: week,
      },
    ],
    [list, week],
  );
  return (
    <>
      <Menu items={items} menuLabel="Print" className="btn btn-ghost btn-sm gap-1.5" width="md">
        <Printer className="size-4" aria-hidden="true" />
        Print
      </Menu>
      <PrefetchPageLinks page={list} />
      <PrefetchPageLinks page={week} />
    </>
  );
}
