import type { VitalAverageRow, WindowAverage } from "~/lib/profiles/vitalAverages";

import { Section } from "~/components/ui";

// Recent vital averages (B-100), read-only, for every member: the core types'
// averages and reading counts over the last 7 and 30 days, from
// `useVitalAverages`. The route leaves it out when there's nothing to show.

const readingsText = (count: number) => (count === 1 ? "1 reading" : `${count} readings`);

function WindowCell({ window, unit }: { window: WindowAverage; unit: string }) {
  if (!window.value)
    return (
      <td className="text-base-content/60" data-window={window.days}>
        <span aria-hidden="true">—</span>
        <span className="sr-only">No readings</span>
      </td>
    );
  return (
    <td data-window={window.days}>
      <span className="font-semibold tabular-nums">{window.value}</span>
      {unit && <span className="text-base-content/70 text-sm">{unit === "%" ? unit : ` ${unit}`}</span>}
      <span className="text-base-content/70 block text-xs">{readingsText(window.count)}</span>
    </td>
  );
}

export function VitalAveragesSection({ rows }: { rows: VitalAverageRow[] }) {
  const windows = rows[0]?.windows ?? [];
  return (
    <Section id="vital-averages" title="Recent vital averages">
      <table className="table-sm table">
        <caption className="sr-only">Average readings over the last 7 and 30 days</caption>
        <thead>
          <tr>
            <th scope="col">Vital</th>
            {windows.map((w) => (
              <th key={w.days} scope="col">
                Last {w.days} days
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.type} data-vital={row.type}>
              <th scope="row" className="font-medium">
                {row.label}
              </th>
              {row.windows.map((w) => (
                <WindowCell key={w.days} window={w} unit={row.unit} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}
