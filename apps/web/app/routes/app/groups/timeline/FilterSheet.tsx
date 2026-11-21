import type { TimelineEntryKind, VitalType } from "@caretook/data/schema";
import type { ReactNode } from "react";
import type { LinkChip } from "~/components/ui";
import type { PeriodChoice } from "~/lib/care-periods/periodSearch";

import { VITAL_TYPES, VITALS } from "@caretook/data/schema";
import { useId } from "react";
import { Link, useLocation } from "react-router";
import { ChipGroup, Sheet } from "~/components/ui";
import { KIND_META } from "~/lib/timeline/entryDisplay";
import {
  clearAuthor,
  clearKind,
  clearPeriod,
  clearVital,
  setKind,
  setPeriod,
  setVital,
  TIMELINE_KINDS,
} from "~/lib/timeline/timelineFilters";

/**
 * The Filter button's sheet: Kind (All or one kind), the vital types under
 * Vitals (`vitalTypes`: the types the group has readings of, and the current
 * one), the care period while searching, then the author and search filters
 * when they're on (`extra`: their removable chips). Every choice is a link
 * through `lib/timeline/timelineFilters.ts`, so it applies at once and the
 * URL keeps it. Clear removes every filter but the search; Done closes.
 */
export function FilterSheet({
  onClose,
  kind,
  vital,
  vitalTypes,
  period,
  extra,
}: {
  onClose: () => void;
  kind: TimelineEntryKind | null;
  vital: VitalType | null;
  vitalTypes: readonly string[];
  /** Only while searching: the group's periods, and the chosen one. */
  period: { choices: readonly PeriodChoice[]; current: PeriodChoice | null } | null;
  /** The author and Matching chips (none when neither is on). */
  extra: readonly LinkChip[];
}) {
  const { search } = useLocation();
  const types = VITAL_TYPES.filter((t) => t === vital || vitalTypes.includes(t));
  const links = { replace: true, preventScrollReset: true } as const;

  return (
    <Sheet isOpen onOpenChange={(open) => !open && onClose()} title="Filter entries">
      <div className="space-y-4 pt-2">
        <Section title="Kind">
          <ChipGroup
            label="Show entries"
            {...links}
            links={[
              { id: "all", label: "All", to: { search: clearKind(search) }, current: !kind },
              ...TIMELINE_KINDS.map((k) => ({
                id: k,
                label: KIND_META[k].plural,
                to: { search: setKind(search, k) },
                current: kind === k,
              })),
            ]}
          />
        </Section>
        {kind === "vital" && types.length > 0 && (
          <Section title="Vital type">
            <ChipGroup
              label="Show vital types"
              {...links}
              links={[
                {
                  id: "all-vitals",
                  label: "All vitals",
                  to: { search: clearVital(search) },
                  current: !vital,
                },
                ...types.map((t) => ({
                  id: `vital-${t}`,
                  label: VITALS[t].label,
                  to: { search: setVital(search, t) },
                  current: vital === t,
                })),
              ]}
            />
          </Section>
        )}
        {period && period.choices.length > 0 && (
          <Section title="Period">
            <ChipGroup
              label="Search within a care period"
              {...links}
              links={[
                {
                  id: "any-period",
                  label: "Every date",
                  to: { search: clearPeriod(search) },
                  current: !period.current,
                },
                ...period.choices.map((choice) => ({
                  id: `period-${choice.id}`,
                  label: choice.name,
                  name: `${choice.name}, ${choice.dates}`,
                  to: { search: setPeriod(search, choice.id) },
                  current: period.current?.id === choice.id,
                })),
              ]}
            />
          </Section>
        )}
        {extra.length > 0 && (
          <Section title="Also on">
            <ChipGroup label="Other filters" {...links} links={extra} />
          </Section>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Link
            {...links}
            to={{ search: clearKind(clearAuthor(clearPeriod(search))) }}
            className="btn btn-ghost btn-sm"
            data-filter-clear
          >
            Clear
          </Link>
          <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </Sheet>
  );
}

/** A titled part of the sheet. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <h4 id={id} className="text-base-content/70 mb-1.5 text-sm font-medium">
        {title}
      </h4>
      {children}
    </section>
  );
}
