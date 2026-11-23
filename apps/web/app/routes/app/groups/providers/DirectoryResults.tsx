import type { ProviderType } from "@caretook/data/schema";
import type { DirectoryList } from "~/lib/providers/providerDirectory";
import type { LocalProvider } from "~/lib/providers/providers.sync";

import { EmptyState } from "~/components/ui";
import { useGroup } from "~/lib/app-shell/group";
import { sectionAccent } from "~/lib/app-shell/sectionAccents";
import { PROVIDER_TYPE_META } from "~/lib/providers/providerDirectory";
import { ProviderListItem } from "./ProviderListItem";

const countLabel = (n: number) => `${n} ${n === 1 ? "provider" : "providers"}`;

function ProviderList({
  providers,
  practiceNames,
  label,
}: {
  providers: LocalProvider[];
  practiceNames: Map<string, string>;
  label: string;
}) {
  return (
    <ul
      aria-label={label}
      className="rounded-box border-base-300 bg-base-100 divide-base-200 divide-y overflow-hidden border"
    >
      {providers.map((p) => (
        <ProviderListItem
          key={p.id}
          provider={p}
          practiceName={p.practiceId ? (practiceNames.get(p.practiceId) ?? null) : null}
        />
      ))}
    </ul>
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
}: {
  /** Every provider in the group, before filtering. */
  total: number;
  list: DirectoryList<LocalProvider>;
  practiceNames: Map<string, string>;
  /** What's typed in the search box. */
  text: string;
  type: ProviderType | null;
}) {
  const shown = list.current.length + list.past.length;
  const kind = type ? PROVIDER_TYPE_META[type].plural.toLowerCase() : "providers";
  const filtered = !!text.trim() || !!type;
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
          emptyMark ? (
            <EmptyState {...emptyMark}>No providers yet.</EmptyState>
          ) : (
            <p className="text-base-content/70">No providers yet.</p>
          )
        ) : (
          shown === 0 && (
            <p className="text-base-content/70" data-empty>
              {text.trim() ? `No ${kind} match “${text.trim()}”.` : `No ${kind}.`}
            </p>
          )
        )}

        {list.current.length > 0 && (
          <ProviderList providers={list.current} practiceNames={practiceNames} label="Current providers" />
        )}

        {list.past.length > 0 && (
          <section aria-labelledby="past-heading" className="space-y-2">
            <h3 id="past-heading" className="text-base-content/70 text-sm font-semibold">
              Past providers
            </h3>
            <ProviderList providers={list.past} practiceNames={practiceNames} label="Past providers" />
          </section>
        )}
      </section>
    </>
  );
}
