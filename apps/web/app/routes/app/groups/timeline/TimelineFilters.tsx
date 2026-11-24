import type { TimelineEntryKind, VitalType } from "@caretook/data/schema";
import type { LinkChip } from "~/components/ui";
import type { PeriodChoice } from "~/lib/care-periods/periodSearch";
import type { ReactNode } from "react";

import { VITALS } from "@caretook/data/schema";
import { CalendarRange, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useLocation } from "react-router";
import { MemberAvatar } from "~/components/members";
import {
  Button,
  ChipGroup,
  CIRCLE,
  Collapse,
  COUNT_BADGE,
  Field,
  ICON_SM,
  IconButton,
} from "~/components/ui";
import { KIND_META } from "~/lib/timeline/entryDisplay";
import { useGroup } from "~/lib/app-shell/group";
import { duringChipName, duringText } from "~/lib/care-periods/periodSearch";
import { recordSearch } from "~/lib/search/recentSearches";
import { useSymptomFilterTypes } from "~/lib/timeline/symptomFilter.sync";
import {
  clearAuthor,
  clearKind,
  clearPeriod,
  clearQuery,
  clearVital,
  removeSymptom,
} from "~/lib/timeline/timelineFilters";
import { FilterSheet } from "./FilterSheet";
import { TimelineDayPicker } from "./TimelineDayPicker";
import { useSearchField } from "./useSearchField";

const X_ICON = <X className={ICON_SM} aria-hidden="true" />;
const NO_SYMPTOMS: readonly string[] = [];

/**
 * The filter row: the search magnifier, then one icon-only Filter button
 * (its badge the count of filters on: kind, vital type, each symptom type, author, period;
 * named "Filter" or "Filter, N on"), which opens `FilterSheet`, the date
 * button (`TimelineDayPicker`), then the
 * optional `trailing` control at the row's right end (the full timeline's
 * View options; drawn as `TOOL_CIRCLE`, from `ui/`). All three are one size of circle. Under them, each filter on is a removable chip (a link that
 * clears only it, so the URL keeps the rest; see
 * `lib/timeline/timelineFilters.ts`): the kind, the vital type (`?vital=`),
 * each symptom type (`?symptom=`, by its catalog name),
 * "By <name>" (`author`: that person's name and avatar), "Matching “…”"
 * (the search, while its field is closed) and "During …" (`?period=`). No
 * filters, no chip row. The magnifier opens the search field beside the
 * button; a search used there (Enter, leaving the field) is saved to the
 * recent searches the search page lists.
 * The open field fills the room between Filter and `trailing`, sliding open
 * and shut (`Collapse`, inline); closed, it stays mounted but hidden.
 */
export function FilterChips({
  kind,
  author,
  q,
  vital = null,
  vitalTypes = [],
  symptoms = NO_SYMPTOMS,
  period,
  trailing,
}: {
  kind: TimelineEntryKind | null;
  author: { userId: string; name: string; image: string | null } | null;
  q: string;
  /** The vital-type filter, under the vital kind. */
  vital?: VitalType | null;
  /** The vital types the group has readings of (any order). */
  vitalTypes?: readonly string[];
  /** The symptom-type filter's catalog ids (`?symptom=`), under the symptom kind. */
  symptoms?: readonly string[];
  /** The search's care period: the group's choices, and the chosen one. */
  period: { choices: readonly PeriodChoice[]; current: PeriodChoice | null };
  /** A control for the row's right end (`TOOL_CIRCLE`), after Filter and the open field. */
  trailing?: ReactNode;
}) {
  const { search } = useLocation();
  const { userId, id: groupId } = useGroup();
  const symptomTypes = useSymptomFilterTypes(groupId);
  const field = useSearchField(q, (text) => recordSearch(userId, text));
  const fieldId = useId();
  const magnifier = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  useEffect(() => {
    if (field.open) input.current?.focus();
  }, [field.open]);
  const close = () => {
    field.close();
    magnifier.current?.focus();
  };

  const during = q ? period.current : null;
  const count = [kind, vital, author, during].filter(Boolean).length + symptoms.length;
  const authorChip: LinkChip | null = author && {
    id: "author",
    label: `By ${author.name}`,
    name: `By ${author.name}: clear this filter`,
    to: { search: clearAuthor(search) },
    current: true,
    leading: (
      <MemberAvatar
        userId={author.userId}
        name={author.name}
        image={author.image}
        size="xs"
        className="-ml-1.5"
      />
    ),
    trailing: X_ICON,
  };
  const matchingChip: LinkChip | null = q
    ? {
        id: "search",
        label: `Matching “${chipText(q)}”`,
        name: `Matching “${q}”: clear the search`,
        to: { search: clearQuery(search) },
        current: true,
        trailing: X_ICON,
      }
    : null;
  const active: LinkChip[] = [
    ...(kind ? [removable("kind", KIND_META[kind].plural, clearKind(search))] : []),
    ...(vital ? [removable("vital", VITALS[vital].label, clearVital(search))] : []),
    ...symptoms.map((id) =>
      removable(
        `symptom-${id}`,
        symptomTypes.find((t) => t.id === id)?.name ?? "Symptom",
        removeSymptom(search, id),
      ),
    ),
    ...(authorChip ? [authorChip] : []),
    ...(matchingChip && !field.open ? [matchingChip] : []),
    ...(during
      ? [
          {
            id: "period",
            label: duringText(during),
            name: duringChipName(during),
            to: { search: clearPeriod(search) },
            current: true,
            leading: <CalendarRange className={ICON_SM} aria-hidden="true" />,
            trailing: X_ICON,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-1.5" data-timeline-filters>
      <div className="flex items-center gap-1.5">
        <IconButton
          ref={magnifier}
          label="Search entries"
          icon={Search}
          expanded={field.open}
          controls={field.open ? fieldId : undefined}
          onPress={field.toggle}
          className={CIRCLE}
        />
        <Button
          variant="ghost"
          size="sm"
          shape="square"
          icon={SlidersHorizontal}
          aria-haspopup="dialog"
          aria-label={count ? `Filter, ${count} on` : "Filter"}
          title={count ? `Filter, ${count} on` : "Filter"}
          className={`relative ${CIRCLE}`}
          onClick={() => setSheetOpen(true)}
          data-filter-button=""
        >
          {count > 0 && (
            <span aria-hidden="true" className={COUNT_BADGE} data-filter-count>
              {count}
            </span>
          )}
        </Button>
        <TimelineDayPicker label="Go to a day" />
        <Collapse open={field.open} axis="inline" id={fieldId} className="min-w-0 flex-1">
          <Field label="Search entries" labelHidden>
            {(control) => (
              <input
                {...control}
                ref={input}
                type="search"
                autoComplete="off"
                enterKeyHint="search"
                placeholder="Search entries"
                className="input input-sm w-full rounded-full"
                value={field.value}
                onChange={(e) => field.change(e.currentTarget.value)}
                onBlur={field.used}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    field.submit();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    close();
                  }
                }}
                data-search-field
              />
            )}
          </Field>
        </Collapse>
        {trailing && <div className="ml-auto flex shrink-0">{trailing}</div>}
      </div>
      {active.length > 0 && <ChipGroup label="Filters on" replace preventScrollReset links={active} />}
      {sheetOpen && (
        <FilterSheet
          onClose={() => setSheetOpen(false)}
          kind={kind}
          vital={vital}
          vitalTypes={vitalTypes}
          symptoms={symptoms}
          symptomTypes={symptomTypes}
          period={q ? period : null}
          extra={[...(authorChip ? [authorChip] : []), ...(matchingChip ? [matchingChip] : [])]}
        />
      )}
    </div>
  );
}

/** A filter's chip: its label and a ✕, named for what it does. */
const removable = (id: string, label: string, search: string): LinkChip => ({
  id,
  label,
  name: `${label}: clear this filter`,
  to: { search },
  current: true,
  trailing: X_ICON,
});

/** The search as its chip shows it: long text is cut short (the chip's name has it all). */
const chipText = (q: string) => (q.length > 32 ? `${q.slice(0, 31).trimEnd()}…` : q);
