import type { ReactNode } from "react";
import type { UnitChoices } from "@caretook/data/schema";
import type { SimpleModeState } from "~/lib/useSimpleMode";
import type { TimelineData } from "./useTimelineData";

import { Link } from "react-router";
import { QuickEntryBox } from "~/components/quick-entry";
import { appUrls } from "~/lib/appUrls";
import { useGroup } from "~/lib/group";
import { nextStripText, upcomingTitle } from "~/lib/upcomingLabels";
import { RemoveLastEntry } from "./RemoveLastEntry";
import { COLUMN_CAP, TimelineEntryList } from "./TimelineEntryList";
import { SimpleModeToggle } from "./SimpleModeToggle";
import { SimpleTiles } from "./SimpleTiles";
import { useSimpleTiles } from "./useSimpleTiles";

/** "Thursday, November 19": today, under the recipient's name. */
export const simpleTodayText = (now: Date, locale?: string) =>
  now.toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric" });

/**
 * Simple mode's timeline (assistant PRD): one large-type column with the
 * recipient's name and today; for writers the quick-entry box in large type
 * with a hint to dictate, the four tiles and "Remove my last entry"; for
 * viewers the next appointment as text; then the timeline's rows, bigger
 * and read-only (`TimelineEntryList`'s `simple`). No strips, filters,
 * search, add menu or layout switch; the /app header is reduced to match
 * (`useSimpleFrame`).
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
      {mode.inputs && (
        <div className={`space-y-3 ${COLUMN_CAP}`}>
          <WriterTiles canChoose={(group.role === "owner" || group.role === "admin") && !mode.locked} />
          <RemoveLastEntry groupId={group.id} userId={group.userId} now={data.now} />
        </div>
      )}
      {!mode.inputs && <NextText next={data.next} now={data.now} />}
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

/** The tiles: writers only (viewers have none to tap), so only they read the tiles' data. */
function WriterTiles({ canChoose }: { canChoose: boolean }) {
  const group = useGroup();
  const { tiles, setting, words } = useSimpleTiles(group.id);
  return (
    <SimpleTiles groupId={group.id} tiles={tiles} setting={setting} words={words} canChoose={canChoose} />
  );
}

/** A viewer's next appointment or reminder, as a line of text that opens it. Nothing when none is ahead. */
function NextText({ next, now }: { next: TimelineData["next"]; now: Date }) {
  const group = useGroup();
  const text = nextStripText(next, now);
  if (!next.next || !text) return null;
  return (
    <p className={`text-xl ${COLUMN_CAP}`} data-simple-next="">
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
