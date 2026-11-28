import type { SearchPageData } from "./loadSearch";
import type { UnitChoices } from "@caretook/data/schema";
import type { ResultSection } from "~/lib/search/searchResults";
import type { EasyOpenedRef } from "./useEasyOpened";

import { useMemo, useState } from "react";
import { Link } from "react-router";
import { LINK, TITLE_SECTION } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import { resultCountText } from "~/lib/search/searchResults";
import { useSchedulePasses } from "~/lib/medications/medicationPasses.sync";
import { EasyResultSheet } from "./EasyResultSheet";
import { ConditionResultItem } from "./ConditionResultItem";
import { EntryResultItem } from "./EntryResultItem";
import { MedicationResultItem } from "./MedicationResultItem";
import { ProviderResultItem } from "./ProviderResultItem";
import { TodoResultItem } from "./TodoResultItem";
import { parseSearch } from "@caretook/data/domain";

/**
 * Everything under the field: one polite status line (the count, "No
 * matches…", or "Preparing search…"), then a section per type with matches,
 * each a list of its best few and a way to see the rest. For the easy roles
 * a provider, medication or condition opens a read-only sheet here
 * (`EasyResultSheet`) rather than its section, and entries have no "See all
 * in timeline" (the easy view has no search to show it).
 */
export function SearchResults({
  data,
  groupId,
  canWrite,
  units,
  preparing,
  unavailable,
}: {
  data: SearchPageData;
  groupId: string;
  canWrite: boolean;
  units: UnitChoices;
  preparing: boolean;
  unavailable: boolean;
}) {
  const text = data.q.trim() !== "";
  // A tag with no text lists what carries it (`loadSearch`), without the index.
  const listing = !text && !!data.tag;
  const now = new Date();
  // The results' own search (they can be the previous text's for a moment), for marking matches.
  const search = useMemo(() => parseSearch(data.q), [data.q]);
  // Medications' schedules read by pass name.
  const passes = useSchedulePasses(groupId);
  const group = useGroup();
  // Todos' due days are the recipient's.
  const timeZone = group.recipient?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  // The easy roles' read-only sheet, when one is open.
  // Only which one: the sheet reads the row as it is now, so synced edits and deletes show (B-469).
  const [opened, setOpened] = useState<EasyOpenedRef | null>(null);
  const open = (item: EasyOpenedRef) => (group.easyRole ? () => setOpened(item) : undefined);
  const status = listing
    ? resultCountText(data.sections, data.q, data.tagName)
    : unavailable
      ? "Search isn't available on this device right now."
      : preparing && !data.sections.length
        ? "Preparing search…"
        : !text
          ? ""
          : data.empty
            ? "Add a word to search for: a search of only -exclusions matches nothing."
            : resultCountText(data.sections, data.q, data.tagName);

  return (
    <>
      <p role="status" className="text-muted min-h-5 text-sm" data-search-status data-for={data.q}>
        {status}
      </p>
      {data.sections.map((section) => (
        <section key={section.type} aria-labelledby={`results-${section.type}`} data-section={section.type}>
          <h2 id={`results-${section.type}`} className="mb-1 flex items-baseline justify-between gap-2 px-1">
            <span className={TITLE_SECTION}>{section.label}</span>
            <span className="text-faint text-sm">{section.total}</span>
          </h2>
          <ul className="divide-base-300 border-base-300 divide-y rounded-box border">
            {section.hits.map((hit) => {
              if (section.type === "entry") {
                const entry = data.entries[hit.id];
                return (
                  entry && (
                    <EntryResultItem
                      key={hit.id}
                      entry={entry}
                      groupId={groupId}
                      canWrite={canWrite}
                      units={units}
                      now={now}
                      search={search}
                      namedTags={data.namedTags[hit.id]}
                    />
                  )
                );
              }
              if (section.type === "provider") {
                const provider = data.providers[hit.id];
                return (
                  provider && (
                    <ProviderResultItem
                      key={hit.id}
                      provider={provider}
                      notes={data.notes[hit.id]}
                      search={search}
                      onOpen={open({ type: "provider", id: provider.id })}
                      namedTags={data.namedTags[hit.id]}
                    />
                  )
                );
              }
              if (section.type === "condition") {
                const condition = data.conditions[hit.id];
                return (
                  condition && (
                    <ConditionResultItem
                      key={hit.id}
                      condition={condition}
                      search={search}
                      onOpen={open({ type: "condition", id: condition.id })}
                    />
                  )
                );
              }
              if (section.type === "todo") {
                const todo = data.todos[hit.id];
                return (
                  todo && (
                    <TodoResultItem
                      key={hit.id}
                      todo={todo}
                      notes={data.notes[hit.id]}
                      now={now}
                      timeZone={timeZone}
                      search={search}
                      namedTags={data.namedTags[hit.id]}
                    />
                  )
                );
              }
              const medication = data.medications[hit.id];
              return (
                medication && (
                  <MedicationResultItem
                    key={hit.id}
                    medication={medication}
                    passes={passes}
                    notes={data.notes[hit.id]}
                    search={search}
                    onOpen={open({ type: "medication", id: medication.id })}
                    namedTags={data.namedTags[hit.id]}
                  />
                )
              );
            })}
          </ul>
          <SectionLinks
            section={section}
            groupId={groupId}
            q={data.q}
            period={data.period}
            tag={data.tag}
            timeline={!group.easyRole}
          />
        </section>
      ))}
      {opened && (
        <EasyResultSheet
          openedRef={opened}
          groupId={groupId}
          data={data}
          passes={passes}
          onClose={() => setOpened(null)}
        />
      )}
    </>
  );
}

/**
 * "Show all N" (or "Show fewer") for the section, and, under entries, "See
 * all N in timeline" (with the care period, as the timeline's period chip, and the tag).
 */
function SectionLinks({
  section,
  groupId,
  q,
  period,
  tag,
  timeline: seeTimeline,
}: {
  section: ResultSection;
  groupId: string;
  q: string;
  period: string | null;
  tag: string | null;
  /** Whether entries offer "See all N in timeline". */
  timeline: boolean;
}) {
  const toggle = section.full
    ? { label: "Show fewer", to: appUrls.search(groupId, q, { period, tag }) }
    : section.hidden > 0
      ? {
          label: `Show all ${section.total}`,
          to: appUrls.search(groupId, q, { all: section.type, period, tag }),
        }
      : null;
  const timeline = seeTimeline && section.type === "entry";
  if (!toggle && !timeline) return null;
  return (
    <p className="mt-1 flex flex-wrap justify-end gap-x-4 px-1 text-sm">
      {toggle && (
        <Link
          to={toggle.to}
          replace
          preventScrollReset
          className={`${LINK} link-hover`}
          data-show-all={section.type}
        >
          {toggle.label}
          <span className="sr-only"> {section.label.toLowerCase()}</span>
        </Link>
      )}
      {timeline && (
        <Link
          to={appUrls.timeline(groupId, { q: q.trim(), period, tag })}
          className={`${LINK} link-hover`}
          data-see-timeline
        >
          See all {section.total} in timeline
        </Link>
      )}
    </p>
  );
}
