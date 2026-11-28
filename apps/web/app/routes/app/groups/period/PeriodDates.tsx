import type { LocalCarePeriod } from "~/lib/care-periods/carePeriods.sync";

import { Section } from "~/components/ui";
import { dayText, lengthText, startText } from "~/lib/care-periods/periodDisplay";
import type { PeriodSpan } from "@caretook/data/domain";
import { periodDay, periodLengthDays } from "@caretook/data/domain";

/**
 * When the period started, until when (the next period's start, as that one
 * shows it; "Now · day N" for the current one), and how long it lasted, all
 * in the recipient's zone.
 */
export function PeriodDates({
  span,
  next,
  timeZone,
  now,
}: {
  span: PeriodSpan<LocalCarePeriod>;
  next: PeriodSpan<LocalCarePeriod> | null;
  timeZone: string;
  now: Date;
}) {
  return (
    <Section title="Dates" id="dates">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm" data-period-details>
        <dt className="text-muted">Started</dt>
        <dd data-period-start>{startText(span.startsAt, span.period.dateOnly, timeZone, now)}</dd>
        <dt className="text-muted">Until</dt>
        <dd data-period-end>
          {span.endsAt
            ? startText(span.endsAt, !!next?.period.dateOnly, timeZone, now)
            : `Now · ${dayText(periodDay(span.startsAt, now, timeZone))}`}
        </dd>
        {span.endsAt && (
          <>
            <dt className="text-muted">Length</dt>
            <dd data-period-length>{lengthText(periodLengthDays(span, now, timeZone))}</dd>
          </>
        )}
      </dl>
    </Section>
  );
}
