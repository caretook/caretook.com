import type { WeeklySheet } from "./weeklySheet";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router";
import { Button, Field } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { parseWeekStart } from "./weeklySheet";

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
      <Button
        to={to(sheet.previousStart)}
        replace
        preventScrollReset
        variant="ghost"
        size="sm"
        icon={ChevronLeft}
        data-week-previous=""
      >
        Previous week
      </Button>
      <Button
        to={to(sheet.thisWeekStart)}
        replace
        preventScrollReset
        variant="ghost"
        size="sm"
        aria-current={isThisWeek ? "true" : undefined}
        data-week-this=""
      >
        This week
      </Button>
      <Button to={to(sheet.nextStart)} replace preventScrollReset variant="ghost" size="sm" data-week-next="">
        Next week
        <ChevronRight className="size-4" aria-hidden="true" />
      </Button>
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
