import type { ReactNode } from "react";
import type { DaySummaryMode, UnitChoices } from "@caretook/data/schema";
import type { SimpleModeState } from "~/lib/assistant/useSimpleMode";
import type { TimelineData } from "./useTimelineData";

import { Link } from "react-router";
import { QuickEntryBox } from "~/components/quick-entry";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import { nextStripText, upcomingTitle } from "~/lib/appointments/upcomingLabels";
import { RemoveLastEntry } from "./RemoveLastEntry";
import { SimpleNow } from "./SimpleNow";
import { SimpleTasks } from "./SimpleTasks";
import { COLUMN_CAP, TimelineEntryList } from "./TimelineEntryList";
import { SimpleModeToggle } from "./SimpleModeToggle";
import { SimpleTiles, SimpleTilesSkeleton } from "./SimpleTiles";
import { useSimpleTiles } from "./useSimpleTiles";

/** "Thursday, November 19": today, under the recipient's name. */
export const simpleTodayText = (now: Date, locale?: string) =>
  now.toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric" });

/**
 * Simple mode's timeline (assistant PRD): one large-type column with the
 * recipient's name and today; for writers the quick-entry box in large type
 * with a hint to dictate; the Now block (due passes with Given all, the next
 * appointment; for viewers as text); "My tasks" (mine, with big ticks;
 * viewers too); for writers the four tiles and "Remove
 * my last entry"; then the timeline's rows, bigger
 * and read-only (`TimelineEntryList`'s `simple`). No strips, filters,
 * search, add menu or layout switch; the /app header is reduced to match
 * (`useSimpleFrame`).
 */
export function SimpleTimeline({
  data,
  units,
  mode,
  summaryMode,
  children,
}: {
  data: TimelineData;
  units: UnitChoices;
  mode: SimpleModeState;
  /** The viewer's day summaries setting (set from the full view's header). */
  summaryMode?: DaySummaryMode;
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
      <SimpleNow
        groupId={group.id}
        canWrite={mode.inputs}
        next={hasNext(data.next, data.now) ? <NextText next={data.next} now={data.now} /> : null}
        className={COLUMN_CAP}
      />
      <SimpleTasks className={COLUMN_CAP} />
      {mode.inputs && (
        <div className={`space-y-3 ${COLUMN_CAP}`}>
          <WriterTiles canChoose={(group.role === "owner" || group.role === "admin") && !mode.locked} />
          <RemoveLastEntry groupId={group.id} userId={group.userId} now={data.now} />
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

/** The next appointment or reminder, as a line of text that opens it (the Now block's). Nothing when none is ahead. */
function NextText({ next, now }: { next: TimelineData["next"]; now: Date }) {
  const group = useGroup();
  const text = nextStripText(next, now);
  if (!next.next || !text) return null;
  return (
    <p className="text-xl" data-simple-next="">
      <Link
        to={appUrls.entry(group.id, next.next.id)}
        className="link-hover"
        aria-label={`${text}: open ${upcomingTitle(next.next)}`}
      >
        {text}
      </Link>
    </p>
  );
}
