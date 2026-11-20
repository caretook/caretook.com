import type { WeeklySheet } from "./weeklySheet";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { Field } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { parseWeekStart } from "./weeklySheet";

const LINK = "btn btn-ghost btn-sm gap-1";

/**
 * Which week the sheet is: the week before or after, this week, or a start
 * day of your own. Each replaces the URL, so Back still leaves the sheet.
 */
export function WeekPicker({ groupId, sheet }: { groupId: string; sheet: WeeklySheet }) {
  const navigate = useNavigate();
  const to = (start: string) => appUrls.medicationsPrintWeek(groupId, start);
  const isThisWeek = sheet.start === sheet.thisWeekStart;

  return (
    <nav aria-label="Week" className="flex flex-wrap items-end gap-x-2 gap-y-1 print:hidden" data-week-picker>
      <Link to={to(sheet.previousStart)} replace preventScrollReset className={LINK} data-week-previous>
        <ChevronLeft className="size-4" aria-hidden="true" />
        Previous week
      </Link>
      <Link
        to={to(sheet.thisWeekStart)}
        replace
        preventScrollReset
        className={LINK}
        aria-current={isThisWeek ? "true" : undefined}
        data-week-this
      >
        This week
      </Link>
      <Link to={to(sheet.nextStart)} replace preventScrollReset className={LINK} data-week-next>
        Next week
        <ChevronRight className="size-4" aria-hidden="true" />
      </Link>
      <Field label="Starts on" className="ms-auto">
        {(control) => (
          <input
            {...control}
            type="date"
            className="input input-sm"
            value={sheet.start}
            onChange={(e) => {
              const start = parseWeekStart(e.currentTarget.value);
              if (start) void navigate(to(start), { replace: true, preventScrollReset: true });
            }}
            data-week-start
          />
        )}
      </Field>
    </nav>
  );
}
