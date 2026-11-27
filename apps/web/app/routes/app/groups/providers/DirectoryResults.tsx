import type { ProvidersView, ProviderType } from "@caretook/data/schema";
import type { DirectoryList, TagsByRecord } from "~/lib/providers/providerDirectory";
import type { LocalProvider } from "~/lib/providers/providers.sync";

import { EmptyState, List, TITLE_SUB } from "~/components/ui";
import { useGroup } from "~/lib/app-shell/group";
import { sectionAccent } from "~/lib/app-shell/sectionAccents";
import { PROVIDER_TYPE_META } from "~/lib/providers/providerDirectory";
import { ProviderListItem } from "./ProviderListItem";

const countLabel = (n: number) => `${n} ${n === 1 ? "provider" : "providers"}`;

function ProviderList({
  providers,
  practiceNames,
  label,
  recordTags,
  view,
}: {
  providers: LocalProvider[];
  practiceNames: Map<string, string>;
  label: string;
  recordTags?: TagsByRecord;
  view: ProvidersView;
}) {
  return (
    <List label={label} data-view={view}>
      {providers.map((p) => (
        <ProviderListItem
          key={p.id}
          provider={p}
          practiceName={p.practiceId ? (practiceNames.get(p.practiceId) ?? null) : null}
          tags={recordTags?.get(p.id)}
          condensed={view === "rows"}
        />
      ))}
    </List>
  );
}

/**
 * The directory's results: current providers, then past ones under their own
 * label, or why nothing shows. A status line announces how many match after
 * each search or filter.
 */
export function DirectoryResults({
  total,
  list,
  practiceNames,
  text,
  type,
  tagged = false,
  recordTags,
  view = "rows",
}: {
  /** Every provider in the group, before filtering. */
  total: number;
  list: DirectoryList<LocalProvider>;
  practiceNames: Map<string, string>;
  /** What's typed in the search box. */
  text: string;
  type: ProviderType | null;
  /** Whether a tag filters the list. */
  tagged?: boolean;
  /** Each provider's tags, for the rows' chips. */
  recordTags?: TagsByRecord;
  /** Condensed rows (the default) or the fuller items (`useProvidersView`). */
  view?: ProvidersView;
}) {
  const shown = list.current.length + list.past.length;
  const kind = type ? PROVIDER_TYPE_META[type].plural.toLowerCase() : "providers";
  const filtered = !!text.trim() || !!type || tagged;
  const { easyRole } = useGroup();
  const emptyMark = filtered ? undefined : sectionAccent("providers", { easy: easyRole });
  return (
    <>
      <p role="status" className="sr-only">
        {total === 0 ? "" : countLabel(shown)}
      </p>

      <section aria-labelledby="providers-heading" className="space-y-4">
        <h2 id="providers-heading" className="sr-only">
          {type ? PROVIDER_TYPE_META[type].plural : "All providers"}
        </h2>

        {total === 0 ? (
          <EmptyState {...emptyMark}>No providers yet.</EmptyState>
        ) : (
          shown === 0 && (
            <EmptyState data-empty="">
              {text.trim() ? `No ${kind} match “${text.trim()}”.` : `No ${kind}.`}
            </EmptyState>
          )
        )}

        {list.current.length > 0 && (
          <ProviderList
            providers={list.current}
            practiceNames={practiceNames}
            label="Current providers"
            recordTags={recordTags}
            view={view}
          />
        )}

        {list.past.length > 0 && (
          <section aria-labelledby="past-heading" className="space-y-2">
            <h3 id="past-heading" className={`${TITLE_SUB} text-muted`}>
              Past providers
            </h3>
            <ProviderList
              providers={list.past}
              practiceNames={practiceNames}
              label="Past providers"
              recordTags={recordTags}
              view={view}
            />
          </section>
        )}
      </section>
    </>
  );
}
