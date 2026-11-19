import type { SearchPageData } from "./loadSearch";
import type { UnitChoices } from "@caretook/data/schema";
import type { ResultSection } from "~/lib/searchResults";

import { Link } from "react-router";
import { appUrls } from "~/lib/appUrls";
import { resultCountText } from "~/lib/searchResults";
import { EntryResultItem, MedicationResultItem, ProviderResultItem } from "./ResultItems";

/**
 * Everything under the field: one polite status line (the count, "No
 * matches…", or "Preparing search…"), then a section per type with matches,
 * each a list of its best few and a way to see the rest.
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
  const searching = data.q.trim() !== "";
  const now = new Date();
  const status = unavailable
    ? "Search isn't available on this device right now."
    : preparing && !data.sections.length
      ? "Preparing search…"
      : !searching
        ? ""
        : data.empty
          ? "Add a word to search for: a search of only -exclusions matches nothing."
          : resultCountText(data.sections, data.q);

  return (
    <>
      <p role="status" className="text-base-content/70 min-h-5 text-sm" data-search-status data-for={data.q}>
        {status}
      </p>
      {data.sections.map((section) => (
        <section key={section.type} aria-labelledby={`results-${section.type}`} data-section={section.type}>
          <h2 id={`results-${section.type}`} className="mb-1 flex items-baseline justify-between gap-2 px-1">
            <span className="font-semibold">{section.label}</span>
            <span className="text-base-content/60 text-sm">{section.total}</span>
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
                    />
                  )
                );
              }
              if (section.type === "provider") {
                const provider = data.providers[hit.id];
                return provider && <ProviderResultItem key={hit.id} provider={provider} />;
              }
              const medication = data.medications[hit.id];
              return medication && <MedicationResultItem key={hit.id} medication={medication} />;
            })}
          </ul>
          <SectionLinks section={section} groupId={groupId} q={data.q} />
        </section>
      ))}
    </>
  );
}

/** "Show all N" (or "Show fewer") for the section, and, under entries, "See all N in timeline". */
function SectionLinks({ section, groupId, q }: { section: ResultSection; groupId: string; q: string }) {
  const toggle = section.full
    ? { label: "Show fewer", to: appUrls.search(groupId, q) }
    : section.hidden > 0
      ? { label: `Show all ${section.total}`, to: appUrls.search(groupId, q, { all: section.type }) }
      : null;
  const timeline = section.type === "entry";
  if (!toggle && !timeline) return null;
  return (
    <p className="mt-1 flex flex-wrap justify-end gap-x-4 px-1 text-sm">
      {toggle && (
        <Link
          to={toggle.to}
          replace
          preventScrollReset
          className="link link-hover text-primary"
          data-show-all={section.type}
        >
          {toggle.label}
          <span className="sr-only"> {section.label.toLowerCase()}</span>
        </Link>
      )}
      {timeline && (
        <Link
          to={appUrls.timeline(groupId, { q: q.trim() })}
          className="link link-hover text-primary"
          data-see-timeline
        >
          See all {section.total} in timeline
        </Link>
      )}
    </p>
  );
}
