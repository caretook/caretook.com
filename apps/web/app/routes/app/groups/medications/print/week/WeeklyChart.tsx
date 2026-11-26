import type { WeeklyDay, WeeklySheet } from "./weeklySheet";
import type { ReactNode } from "react";

import { DOSE_MARKS } from "./weeklySheet";

// The weekly sheet itself: a header that says whose chart it is and which
// week, the legend for the marks, then one table: a row per pass and
// medication with G, S and R boxes (given, skipped, refused) and room for
// initials under each day, and blank rows for as-needed medications with
// room for the time. Fixed column widths, so it fits the page at any width;
// rows never split across printed pages (app.css).

const TABLE = "w-full table-fixed border-collapse text-left text-xs";
const CELL = "border-base-content/40 border px-1 py-1 align-top wrap-break-word sm:px-1.5";
const GROUP = "bg-base-200 border-base-content/40 border px-1.5 py-1 text-left font-semibold print:bg-white";

/** One mark's box, its letter inside: separate and square, so a photo reads it. */
const Mark = ({ mark }: { mark: string }) => (
  <span
    className="border-base-content grid size-3.5 shrink-0 place-items-center border text-[0.6rem] leading-none font-semibold sm:size-4"
    data-week-mark={mark}
  >
    {mark}
  </span>
);

/** A box each for given, skipped and refused, then a line for initials: beside them when there's room, so a printed row stays one line high. */
const DoseCell = () => (
  <td className={CELL} data-week-cell>
    <span className="flex flex-wrap items-end gap-0.5 sm:gap-1" aria-hidden="true">
      {DOSE_MARKS.map((m) => (
        <Mark key={m.mark} mark={m.mark} />
      ))}
      <span className="border-base-content/50 h-4 min-w-6 flex-1 border-b border-dotted" data-week-initials />
    </span>
  </td>
);

/** What each mark means, above the table. */
const Legend = () => (
  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" data-week-legend>
    <span className="font-semibold">For each dose, circle or tick one:</span>
    {DOSE_MARKS.map((m) => (
      <span key={m.mark} className="flex items-center gap-1" data-week-legend-mark={m.mark}>
        <Mark mark={m.mark} />
        <span>{m.label}</span>
      </span>
    ))}
    <span>then write your initials.</span>
  </p>
);

/** Room to write the time and initials of an as-needed dose. */
const AsNeededCell = () => (
  <td className={CELL} data-week-cell>
    <span className="text-base-content/70 flex items-end gap-1 text-[0.65rem] leading-none">
      <span aria-hidden="true">Time</span>
      <span className="border-base-content/50 h-4 min-w-0 flex-1 border-b border-dotted" aria-hidden="true" />
    </span>
    <span className="mt-1.5 flex items-end gap-1 text-[0.65rem] leading-none">
      <span className="border-base-content/50 h-4 min-w-0 flex-1 border-b border-dotted" aria-hidden="true" />
    </span>
  </td>
);

const Muted = ({ children }: { children: ReactNode }) => (
  <span className="text-base-content/70 block font-normal">{children}</span>
);

const DayHeads = ({ days }: { days: WeeklyDay[] }) =>
  days.map((d) => (
    <th key={d.day} scope="col" className={`${CELL} text-center font-semibold`} data-week-day={d.day}>
      <span className="block">{d.weekday}</span>
      <span className="block font-normal">{d.date}</span>
    </th>
  ));

export function WeeklyChart({ sheet }: { sheet: WeeklySheet }) {
  const empty = sheet.groups.length === 0 && sheet.asNeeded.length === 0;
  return (
    <article
      className="rounded-box border-base-300 bg-base-100 space-y-4 border p-4 sm:p-6 print:space-y-3 print:rounded-none print:border-0 print:p-0"
      aria-labelledby="week-title"
      data-print-sheet
      data-week-sheet
    >
      <header className="space-y-2">
        <h1 id="week-title" className="text-xl font-semibold">
          Medication chart <span className="font-normal">· {sheet.label}</span>
        </h1>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm sm:grid-cols-[auto_1fr_auto_1fr_auto_1fr]">
          <dt className="font-semibold">Name</dt>
          <dd data-print-field="name">{sheet.recipient.name || "Not recorded"}</dd>
          <dt className="font-semibold">Date of birth</dt>
          <dd data-print-field="dateOfBirth">{sheet.recipient.dateOfBirth ?? "Not recorded"}</dd>
          <dt className="font-semibold">Care group</dt>
          <dd data-print-field="group">{sheet.groupName}</dd>
        </dl>
      </header>

      {empty ? (
        <p className="text-base-content/70 text-sm">No current medications.</p>
      ) : (
        <>
          <Legend />
          <table className={TABLE} data-week-table>
            <caption className="text-base-content/70 caption-bottom pt-1.5 text-left text-xs">
              G given, S skipped, R refused. Printed {sheet.printedOn}.
            </caption>
            <colgroup>
              <col className="w-[23%]" />
              {sheet.days.map((d) => (
                <col key={d.day} className="w-[11%]" />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className={`${CELL} font-semibold`}>
                  Medication
                </th>
                <DayHeads days={sheet.days} />
              </tr>
            </thead>
            {sheet.groups.map((group) => (
              <tbody key={group.key} data-week-group={group.key}>
                <tr>
                  <th scope="colgroup" colSpan={8} className={GROUP} data-week-group-name>
                    {group.name ? `${group.name} · ${group.time}` : group.time}
                  </th>
                </tr>
                {group.rows.map((row) => (
                  <tr key={row.key} data-week-row={row.medicationId}>
                    <th scope="row" className={`${CELL} font-semibold`}>
                      <span data-week-title>{row.title}</span>
                      {row.amount && <Muted>{row.amount}</Muted>}
                    </th>
                    {sheet.days.map((d) => (
                      <DoseCell key={d.day} />
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
            {sheet.asNeeded.length > 0 && (
              <tbody data-week-group="asNeeded">
                <tr>
                  <th scope="colgroup" colSpan={8} className={GROUP} data-week-group-name>
                    As needed · write the time
                  </th>
                </tr>
                {sheet.asNeeded.flatMap((m) =>
                  Array.from({ length: m.lines }, (_, line) => (
                    <tr key={`${m.medicationId}:${line}`} data-week-as-needed={m.medicationId}>
                      {line === 0 && (
                        <th scope="row" rowSpan={m.lines} className={`${CELL} font-semibold`}>
                          <span data-week-title>{m.title}</span>
                          {m.amount && <Muted>{m.amount}</Muted>}
                          {m.limit && <Muted>{m.limit}</Muted>}
                        </th>
                      )}
                      {sheet.days.map((d) => (
                        <AsNeededCell key={d.day} />
                      ))}
                    </tr>
                  )),
                )}
              </tbody>
            )}
          </table>
        </>
      )}
    </article>
  );
}
