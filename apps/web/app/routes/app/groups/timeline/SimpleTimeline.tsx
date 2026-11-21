import type { ReactNode } from "react";
import type { DaySummaryMode, UnitChoices } from "@caretook/data/schema";
import type { SimpleModeState } from "~/lib/assistant/useSimpleMode";
import type { TimelineData } from "./useTimelineData";
import type { TimelineEntryListFilters } from "./TimelineEntryList";

import { QuickEntryBox } from "~/components/quick-entry";
import { useGroup } from "~/lib/app-shell/group";
import { nextStripText } from "~/lib/appointments/upcomingLabels";
import { RemoveLastEntry } from "./RemoveLastEntry";
import { SimpleNext } from "./SimpleNext";
import { SimpleNow } from "./SimpleNow";
import { SimpleTasks } from "./SimpleTasks";
import { COLUMN_CAP, TimelineEntryList } from "./TimelineEntryList";
import { SimpleModeToggle } from "./SimpleModeToggle";
import { SimpleTiles, SimpleTilesSkeleton } from "./SimpleTiles";
import { DICTATION_HINT } from "~/components/quick-entry/QuickEntryBox";
import { useCanDictate } from "~/lib/assistant/canDictate";
import { useSimpleTiles } from "./useSimpleTiles";
import { SIMPLE_BLOCK } from "./layout";

/** "Thursday, November 19": today, under the recipient's name. */
export const simpleTodayText = (now: Date, locale?: string) =>
  now.toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric" });

/**
 * Simple mode's timeline (assistant PRD): one column at the full timeline's type scale with the
 * recipient's name and today; the Upcoming block (due passes with Given all,
 * the next appointment, which opens the next five; for viewers as text); "My tasks" (mine, with big ticks;
 * viewers too); for writers the four tiles in one row and "Remove my last
 * entry", then the quick-entry box (normal size, with a hint to dictate on
 * phones and tablets), the full timeline's search, Filter button and chips
 * (`chips`), then the timeline's rows (`TimelineEntryList`'s `simple`: the
 * full ⋯ menus and sheets for writers). No strips, add menu or layout switch;
 * the /app header is reduced to match (`useSimpleFrame`).
 */
export function SimpleTimeline({
  data,
  units,
  mode,
  summaryMode,
  chips,
  filters,
  children,
}: {
  data: TimelineData;
  units: UnitChoices;
  mode: SimpleModeState;
  /** The viewer's day summaries setting (set from the full view's header). */
  summaryMode?: DaySummaryMode;
  /** The full timeline's `FilterChips` (search, Filter, chips). */
  chips?: ReactNode;
  /** The filters and search on (the URL's), for the list. */
  filters?: TimelineEntryListFilters;
  /** The sheets over the timeline (its `Outlet`), so a card's Edit opens. */
  children?: ReactNode;
}) {
  const group = useGroup();
  const dictate = useCanDictate();
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-6" data-simple-timeline="">
      <header className={`flex items-start justify-between gap-3 ${COLUMN_CAP}`}>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold break-words">{group.displayName}</h1>
          <p className="text-base-content/80 text-base">
            Today · <span data-simple-today>{simpleTodayText(new Date())}</span>
          </p>
        </div>
        <SimpleModeToggle mode={mode} />
      </header>
      <SimpleNow
        groupId={group.id}
        canWrite={mode.inputs}
        next={hasNext(data.next, data.now) ? <SimpleNext next={data.next} now={data.now} /> : null}
        className={COLUMN_CAP}
      />
      <SimpleTasks className={COLUMN_CAP} />
      {mode.inputs && (
        <div className={`space-y-3 ${SIMPLE_BLOCK} ${COLUMN_CAP}`}>
          <WriterTiles canChoose={(group.role === "owner" || group.role === "admin") && !mode.locked} />
          <RemoveLastEntry groupId={group.id} userId={group.userId} now={data.now} />
        </div>
      )}
      {mode.inputs && (
        <div className={`space-y-2 ${SIMPLE_BLOCK} ${COLUMN_CAP}`}>
          <QuickEntryBox groupId={group.id} units={units} size="md" passChips={false} />
          {dictate && (
            <p className="text-base-content/70 text-sm" data-dictation-hint="">
              {DICTATION_HINT}
            </p>
          )}
        </div>
      )}
      {chips}
      <TimelineEntryList
        data={data}
        view="rows"
        units={units}
        groupId={group.id}
        canWrite={group.canWrite}
        kind={filters?.kind ?? null}
        author={filters?.author ?? null}
        vital={filters?.vital}
        search={filters?.search}
        simple
        summaryMode={summaryMode}
      />
      {children}
    </main>
  );
}

/** The tiles: writers only (viewers have none to tap), so only they read the tiles' data. */
function WriterTiles({ canChoose }: { canChoose: boolean }) {
  const group = useGroup();
  const { tiles, setting, words, ready, fresh } = useSimpleTiles(group.id);
  if (!ready) return <SimpleTilesSkeleton />;
  return (
    <SimpleTiles
      groupId={group.id}
      tiles={tiles}
      setting={setting}
      words={words}
      canChoose={canChoose}
      fresh={fresh}
    />
  );
}

const hasNext = (next: TimelineData["next"], now: Date) => !!next.next && !!nextStripText(next, now);
