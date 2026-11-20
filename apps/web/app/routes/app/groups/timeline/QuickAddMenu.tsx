import type { TimelineEntryKind, VitalType } from "@caretook/data/schema";
import type { MenuEntry } from "~/components/ui";
import type { SheetKind } from "~/lib/appUrls";

import { VITAL_TYPES, VITALS } from "@caretook/data/schema";
import { Plus } from "lucide-react";
import { PrefetchPageLinks, useLocation, useNavigate } from "react-router";
import { Menu } from "~/components/ui";
import { appUrls } from "~/lib/appUrls";
import { KIND_META } from "~/lib/entryDisplay";
import { SHEET_LINK_STATE } from "./sheet";

/**
 * The timeline header's + button ("Add to timeline", writers only: the
 * header leaves it out for viewers), opening one menu of what can be added,
 * in the old bar's order: Note, Event, Dose, Symptom, then each vital type
 * under "Vitals". Notes and events open their page; doses, symptoms and
 * vitals their add sheet over the timeline (which keeps the scroll position
 * and the filters, and carries `SHEET_LINK_STATE`). The sheets' route modules
 * are fetched as soon as the button renders, so they open offline.
 */
export function QuickAddMenu({ groupId }: { groupId: string }) {
  const navigate = useNavigate();
  const { search } = useLocation();
  const toSheet = (to: string) => void navigate(to, { state: SHEET_LINK_STATE, preventScrollReset: true });
  const sheet = (kind: SheetKind, type?: VitalType) =>
    toSheet(appUrls.newSheet(groupId, kind, { type, search }));
  const kind = (k: TimelineEntryKind, onAction: () => void) => ({
    id: k,
    label: KIND_META[k].label,
    icon: KIND_META[k].Icon,
    onAction,
  });
  const items: MenuEntry[] = [
    kind("note", () => void navigate(appUrls.newEntry(groupId, "note"))),
    kind("event", () => void navigate(appUrls.newEntry(groupId, "event"))),
    kind("dose", () => toSheet(appUrls.newDose(groupId, { search }))),
    kind("symptom", () => sheet("symptom")),
    {
      type: "section",
      id: "vitals",
      title: "Vitals",
      items: VITAL_TYPES.map((type) => ({
        id: `vital-${type}`,
        label: VITALS[type].label,
        onAction: () => sheet("vital", type),
      })),
    },
  ];
  return (
    <>
      <Menu
        label="Add to timeline"
        className="btn btn-sm btn-square btn-primary"
        items={items}
        width="md"
        scrollable
      >
        <Plus className="size-4" aria-hidden="true" />
      </Menu>
      <PrefetchPageLinks page={appUrls.newSheet(groupId, "symptom")} />
      <PrefetchPageLinks page={appUrls.newDose(groupId)} />
    </>
  );
}
