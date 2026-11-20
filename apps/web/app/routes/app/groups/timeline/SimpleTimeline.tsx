import type { ReactNode } from "react";
import type { UnitChoices } from "@caretook/data/schema";
import type { SimpleModeState } from "~/lib/useSimpleMode";
import type { TimelineData } from "./useTimelineData";

import { QuickEntryBox } from "~/components/quick-entry";
import { useGroup } from "~/lib/group";
import { COLUMN_CAP, TimelineEntryList } from "./TimelineEntryList";
import { SimpleModeToggle } from "./SimpleModeToggle";

/** "Thursday, November 19": today, under the recipient's name. */
export const simpleTodayText = (now: Date, locale?: string) =>
  now.toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric" });

/**
 * Simple mode's timeline (assistant PRD): one large-type column with the
 * recipient's name and today, the quick-entry box in large type with a hint
 * to dictate (writers only), then the timeline's rows, bigger and read-only
 * (`TimelineEntryList`'s `simple`). No strips, filters, search, add menu or
 * layout switch; the /app header is reduced to match (`useSimpleFrame`).
 */
export function SimpleTimeline({
  data,
  units,
  mode,
  children,
}: {
  data: TimelineData;
  units: UnitChoices;
  mode: SimpleModeState;
  /** The sheets over the timeline (its `Outlet`), so a card's Edit opens. */
  children?: ReactNode;
}) {
  const group = useGroup();
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-6" data-simple-timeline="">
      <header className={`flex items-start justify-between gap-3 ${COLUMN_CAP}`}>
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold break-words">{group.displayName}</h1>
          <p className="text-base-content/80 text-xl">
            Today · <span data-simple-today>{simpleTodayText(new Date())}</span>
          </p>
        </div>
        <SimpleModeToggle mode={mode} large />
      </header>
      {mode.inputs && (
        <div className={COLUMN_CAP}>
          <QuickEntryBox groupId={group.id} units={units} size="lg" />
        </div>
      )}
      <TimelineEntryList
        data={data}
        view="rows"
        units={units}
        groupId={group.id}
        canWrite={group.canWrite}
        kind={null}
        author={null}
        simple
      />
      {children}
    </main>
  );
}
