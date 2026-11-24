import type { ReactNode } from "react";
import type { DaySummaryMode, UnitChoices } from "@caretook/data/schema";
import type { EasyModeState } from "~/lib/assistant/useEasyMode";
import type { TimelineData } from "./useTimelineData";
import type { TimelineEntryListFilters } from "./TimelineEntryList";

import { isManagerRole } from "@caretook/data/permissions";
import { useRef } from "react";
import { QuickEntryBox } from "~/components/quick-entry";
import { Page, TITLE_PAGE } from "~/components/ui";
import { useGroup } from "~/lib/app-shell/group";
import { nextStripText } from "~/lib/appointments/upcomingLabels";
import { RemoveLastEntry } from "./RemoveLastEntry";
import { EasyNext } from "./EasyNext";
import { EasyNow } from "./EasyNow";
import { EasyTodos } from "./EasyTodos";
import { COLUMN_CAP, TimelineEntryList } from "./TimelineEntryList";
import { EasyModeToggle } from "./EasyModeToggle";
import { EasyTiles, EasyTilesSkeleton } from "./EasyTiles";
import { GettingStartedCard } from "./GettingStartedCard";
import { DICTATION_HINT } from "~/components/quick-entry/QuickEntryBox";
import { useCanDictate } from "~/lib/assistant/canDictate";
import { useEasyTiles } from "./useEasyTiles";
import { EASY_BLOCK } from "./layout";

/** "Thursday, November 19": today, under the recipient's name. */
export const easyTodayText = (now: Date, locale?: string) =>
  now.toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric" });

/**
 * Easy mode's timeline (assistant PRD): one column at the full timeline's type scale with the
 * recipient's name and today; the Upcoming block (due passes with Given all,
 * the next appointment, which opens the next five; for viewers as text); "My todos" (mine, with big ticks;
 * viewers too); for loggers (writers and an Easy helper) the four tiles in one row and "Remove my last
 * entry", then the quick-entry box (normal size, with a hint to dictate on
 * phones and tablets), the full timeline's search, Filter button and chips
 * (`chips`), then the timeline's rows (`TimelineEntryList`'s `easy`: the
 * full ⋯ menus and sheets for writers, and an Easy helper's on the rows they made). No strips, add menu or layout switch;
 * the /app header is reduced to match (`useEasyFrame`).
 */
export function EasyTimeline({
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
  mode: EasyModeState;
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
  // The setup card's "Log a first entry": the box, in view and focused.
  const quickField = useRef<HTMLTextAreaElement>(null);
  const addEntry = () => {
    const el = quickField.current;
    el?.scrollIntoView({ block: "center" });
    el?.focus({ preventScroll: true });
  };
  return (
    <Page data-easy-timeline="">
      <header className={`flex items-start justify-between gap-3 ${COLUMN_CAP}`}>
        <div className="min-w-0">
          <h1 className={`${TITLE_PAGE} break-words`}>{group.displayName}</h1>
          <p className="text-muted text-base">
            Today · <span data-easy-today>{easyTodayText(new Date())}</span>
          </p>
        </div>
        <EasyModeToggle mode={mode} />
      </header>
      <GettingStartedCard className={COLUMN_CAP} onAddEntry={addEntry} easy />
      <EasyNow
        groupId={group.id}
        canWrite={mode.inputs}
        next={hasNext(data.next, data.now) ? <EasyNext next={data.next} now={data.now} /> : null}
        className={COLUMN_CAP}
      />
      <EasyTodos className={COLUMN_CAP} />
      {mode.inputs && (
        <div className={`space-y-3 ${EASY_BLOCK} ${COLUMN_CAP}`}>
          <LoggerTiles canChoose={isManagerRole(group.role)} />
          <RemoveLastEntry groupId={group.id} userId={group.userId} now={data.now} />
        </div>
      )}
      {mode.inputs && (
        <div className={`space-y-2 ${EASY_BLOCK} ${COLUMN_CAP}`}>
          <QuickEntryBox groupId={group.id} units={units} size="md" passChips={false} fieldRef={quickField} />
          {dictate && (
            <p className="text-muted text-sm" data-dictation-hint="">
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
        symptoms={filters?.symptoms}
        search={filters?.search}
        easy
        summaryMode={summaryMode}
      />
      {children}
    </Page>
  );
}

/** The tiles: loggers only (viewers have none to tap), so only they read the tiles' data. */
function LoggerTiles({ canChoose }: { canChoose: boolean }) {
  const group = useGroup();
  const { tiles, setting, words, ready, fresh } = useEasyTiles(group.id);
  if (!ready) return <EasyTilesSkeleton />;
  return (
    <EasyTiles
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
