import type { Schedule } from "~/lib/appointments/entrySchedule";

import { useState } from "react";
import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderInRouter } from "../../../test/device";
import { ScheduleFields } from "./ScheduleFields";

/** The fields around a schedule the test can read, as a sheet holds one. */
function Held({ initial, onSchedule }: { initial: Schedule; onSchedule: (schedule: Schedule) => void }) {
  const [schedule, setSchedule] = useState(initial);
  return (
    <ScheduleFields
      kind="event"
      schedule={schedule}
      timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}
      onChange={(next) => {
        setSchedule(next);
        onSchedule(next);
      }}
    />
  );
}

describe("ScheduleFields", () => {
  test("an event from 10 AM to 11 AM, with Ends stepped up, ends at 12 PM with no error", async () => {
    // The fields show the device's zone, so the times are built in it.
    const start = new Date(2026, 10, 18, 10).toISOString();
    const end = new Date(2026, 10, 18, 11).toISOString();
    const noon = new Date(2026, 10, 18, 12).toISOString();
    let latest: Schedule | undefined;
    await renderInRouter(
      <Held
        initial={{ occurredAt: start, endsAt: end, allDay: false }}
        onSchedule={(next) => (latest = next)}
      />,
    );

    const endSegment = (type: string) => document.querySelectorAll<HTMLElement>(`[data-type="${type}"]`)[1]!;
    endSegment("hour").focus();
    await userEvent.keyboard("{ArrowUp}");

    await expect.poll(() => endSegment("hour").textContent).toBe("12");
    expect(endSegment("dayPeriod").textContent).toBe("PM");
    expect(latest?.endsAt).toBe(noon);
    await expect.element(page.getByText("Must be after the start")).not.toBeInTheDocument();
  });
});
