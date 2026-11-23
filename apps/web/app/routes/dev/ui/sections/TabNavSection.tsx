import { CalendarClock, List, Ticket } from "lucide-react";
import { useSearchParams } from "react-router";
import { TabNav } from "~/components/ui";
import { Example } from "../Example";

/**
 * Tabs told apart by a search parameter, as sign-in's are: each passes
 * `current` (and `replace`, so the gallery's history stays one step). The
 * hash keeps the page at this section after a tap.
 */
const tabsFor = (key: string, search: URLSearchParams, tabs: { id: string; label: string }[]) =>
  tabs.map((tab) => ({
    label: tab.label,
    to: `/dev/ui?${key}=${tab.id}#tab-nav`,
    current: (search.get(key) ?? tabs[0]!.id) === tab.id,
    replace: true,
  }));

const MEDICATIONS = [
  { id: "schedule", label: "Schedule" },
  { id: "list", label: "List" },
  { id: "passes", label: "Passes" },
];
const ICONS = { schedule: CalendarClock, list: List, passes: Ticket } as const;
const MANY = Array.from({ length: 8 }, (_, i) => ({ id: `${i + 1}`, label: `Section ${i + 1}` }));

export function TabNavSection() {
  const [search] = useSearchParams();
  return (
    <>
      <Example label="Plain">
        <TabNav label="Medications" tabs={tabsFor("plain", search, MEDICATIONS)} />
      </Example>
      <Example label="With icons">
        <TabNav
          label="Medications, with icons"
          tabs={tabsFor("icons", search, MEDICATIONS).map((tab, i) => ({
            ...tab,
            icon: ICONS[MEDICATIONS[i]!.id as keyof typeof ICONS],
          }))}
        />
      </Example>
      <Example label="With a count">
        <TabNav
          label="Medications, with a count"
          tabs={tabsFor("count", search, MEDICATIONS).map((tab, i) =>
            i === 1 ? { ...tab, count: 12 } : tab,
          )}
        />
      </Example>
      <Example label="In a section's accent, with a count">
        <TabNav
          label="Medications, in teal"
          accent="teal"
          tabs={tabsFor("accent", search, MEDICATIONS).map((tab, i) =>
            i === 1 ? { ...tab, count: 12 } : tab,
          )}
        />
      </Example>
      <Example label="Many tabs at phone width (scrolls sideways)">
        <div className="w-full max-w-[420px]">
          <TabNav label="Many sections" tabs={tabsFor("many", search, MANY)} />
        </div>
      </Example>
    </>
  );
}
