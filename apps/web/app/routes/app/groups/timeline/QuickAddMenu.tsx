import type { TimelineEntryKind, VitalType } from "@caretook/data/schema";
import type { MenuEntry } from "~/components/ui";
import type { SheetKind } from "~/lib/timeline/urls";

import { VITAL_TYPES, VITALS } from "@caretook/data/schema";
import { Plus } from "lucide-react";
import { PrefetchPageLinks, useLocation, useNavigate } from "react-router";
import { Menu } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { KIND_META } from "~/lib/timeline/entryDisplay";
import { localTimeZone } from "~/lib/core/format";
import { SHEET_LINK_STATE } from "./sheet";
import { dayKeyIn, dayStartAt } from "./timelineDays";

/**
 * A day heading's + button ("Add to Today", "Add to Monday, Nov 16"; writers
 * only: `DayHeader` leaves it out for viewers and in simple mode), opening
 * one menu of what can be added: Note, Event, Dose, Symptom, then "Vitals",
 * a group that expands in place to each vital type. Notes and events open their page; doses, symptoms and
 * vitals their add sheet over the timeline (which keeps the scroll position
 * and the filters, and carries `SHEET_LINK_STATE`). Today's adds start at
 * now; another day's at 12:00 that day (`dayStartAt`, passed as `?at=`).
 */
export function QuickAddMenu({ groupId, dayKey, label }: { groupId: string; dayKey: string; label: string }) {
  const navigate = useNavigate();
  const { search } = useLocation();
  // Worked out when an item is chosen, so today's stays "now" however long the page is open.
  const startAt = () => {
    const now = new Date();
    const timeZone = localTimeZone();
    return dayKey === dayKeyIn(now.toISOString(), timeZone) ? undefined : dayStartAt(dayKey, timeZone, now);
  };
  const toSheet = (to: string) => void navigate(to, { state: SHEET_LINK_STATE, preventScrollReset: true });
  const sheet = (kind: SheetKind, type?: VitalType) =>
    toSheet(appUrls.newSheet(groupId, kind, { type, search, at: startAt() }));
  const kind = (k: TimelineEntryKind, onAction: () => void) => ({
    id: k,
    label: KIND_META[k].label,
    icon: KIND_META[k].Icon,
    onAction,
  });
  const items: MenuEntry[] = [
    kind("note", () => void navigate(appUrls.newEntry(groupId, "note", { at: startAt() }))),
    kind("event", () => void navigate(appUrls.newEntry(groupId, "event", { at: startAt() }))),
    kind("dose", () => toSheet(appUrls.newDose(groupId, { search, at: startAt() }))),
    kind("symptom", () => sheet("symptom")),
    {
      type: "group",
      id: "vitals",
      label: "Vitals",
      icon: KIND_META.vital.Icon,
      items: VITAL_TYPES.map((type) => ({
        id: `vital-${type}`,
        label: VITALS[type].label,
        onAction: () => sheet("vital", type),
      })),
    },
  ];
  return (
    <Menu
      label={`Add to ${label}`}
      className="btn btn-sm btn-square btn-primary -my-1"
      items={items}
      width="md"
      scrollable
    >
      <Plus className="size-4" aria-hidden="true" />
    </Menu>
  );
}

/**
 * The add sheets' route modules, fetched once for the whole list (not per
 * day's +), so they open offline.
 */
export function QuickAddPrefetch({ groupId }: { groupId: string }) {
  return (
    <>
      <PrefetchPageLinks page={appUrls.newSheet(groupId, "symptom")} />
      <PrefetchPageLinks page={appUrls.newDose(groupId)} />
    </>
  );
}
