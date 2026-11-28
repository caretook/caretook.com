import type { FormEvent } from "react";

import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Button, CIRCLE, Field, ICON, Popover } from "~/components/ui";
import { localTimeZone } from "~/lib/core/format";
import { readDay, setDay } from "~/lib/timeline/timelineFilters";
import { JUMP_LINK_STATE } from "~/lib/timeline/timelineJump";
import { dayInZone } from "@caretook/data/domain";

/**
 * The calendar button that jumps the timeline to a day: a small popover with a
 * native date input (latest: the viewer's today) and Go. `floating` is the
 * look beside Back to today; otherwise it's the toolbar's circle.
 */
export function TimelineDayPicker({ label, floating = false }: { label: string; floating?: boolean }) {
  return (
    <Popover
      label={label}
      dialogLabel="Go to a day"
      variant={floating ? "secondary" : "ghost"}
      size="sm"
      shape="square"
      className={floating ? undefined : CIRCLE}
      trigger={<CalendarDays className={ICON} aria-hidden="true" />}
    >
      {(close) => <DayForm close={close} />}
    </Popover>
  );
}

/** Mounted each time the popover opens, so it starts on the current jump day (else today). */
function DayForm({ close }: { close: () => void }) {
  const { search } = useLocation();
  const navigate = useNavigate();
  const [today] = useState(() => dayInZone(new Date(), localTimeZone()));
  const [value, setValue] = useState(() => readDay(search, today) ?? today);
  const future = value > today;
  const canGo = !!value && !future;

  const go = (event: FormEvent) => {
    event.preventDefault();
    if (!canGo) return;
    close();
    void navigate({ search: setDay(search, value) }, { state: JUMP_LINK_STATE, preventScrollReset: true });
  };

  return (
    <form onSubmit={go} className="space-y-2" data-day-picker="">
      <Field label="Day" kind="input" error={future ? "The timeline ends today." : undefined}>
        {(control) => (
          <input
            {...control}
            type="date"
            name="day"
            required
            max={today}
            value={value}
            onChange={(e) => setValue(e.currentTarget.value)}
          />
        )}
      </Field>
      <Button type="submit" variant="primary" size="sm" block disabled={!canGo}>
        Go
      </Button>
    </form>
  );
}
