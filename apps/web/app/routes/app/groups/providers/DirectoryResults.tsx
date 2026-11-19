import type { ProviderType } from "@caretook/data/schema";
import type { DirectoryList } from "~/lib/providerDirectory";
import type { LocalProvider } from "~/lib/sync/providers";

import { Link, useLocation } from "react-router";
import { PROVIDER_TYPE_META, setPast } from "~/lib/providerDirectory";
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
 * The directory's results: current providers, then past ones behind "Show
 * past (N)" (`?past=1`), or why nothing shows. A status line announces how
 * many match after each search or filter.
 */
export function DirectoryResults({
  total,
  list,
  practiceNames,
  text,
  type,
  past,
}: {
  /** Every provider in the group, before filtering. */
  total: number;
  list: DirectoryList<LocalProvider>;
  practiceNames: Map<string, string>;
  /** What's typed in the search box. */
  text: string;
  type: ProviderType | null;
  past: boolean;
}) {
  const { search } = useLocation();
  const shown = list.current.length + (past ? list.past.length : 0);
  const filtered = !!text.trim() || !!type;
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
          <p className="text-base-content/70">No providers yet.</p>
        ) : (
          list.current.length === 0 &&
          !(past && list.past.length > 0) && (
            <p className="text-base-content/70" data-empty>
              {text.trim()
                ? `No ${type ? PROVIDER_TYPE_META[type].plural.toLowerCase() : "providers"} match “${text.trim()}”.`
                : filtered
                  ? `No current ${type ? PROVIDER_TYPE_META[type].plural.toLowerCase() : "providers"}.`
                  : "No current providers."}
            </p>
          )
        )}

        {list.current.length > 0 && (
          <ProviderList providers={list.current} practiceNames={practiceNames} label="Current providers" />
        )}

        {list.past.length > 0 &&
          (past ? (
            <section aria-labelledby="past-heading" className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 id="past-heading" className="text-base-content/70 text-sm font-semibold">
                  Past providers
                </h3>
                <Link
                  to={{ search: setPast(search, false) }}
                  replace
                  preventScrollReset
                  className="btn btn-ghost btn-sm"
                >
                  Hide past
                </Link>
              </div>
              <ProviderList providers={list.past} practiceNames={practiceNames} label="Past providers" />
            </section>
          ) : (
            <Link
              to={{ search: setPast(search, true) }}
              replace
              preventScrollReset
              className="btn btn-ghost btn-sm"
              data-show-past
            >
              Show past ({list.past.length})
            </Link>
          ))}
      </section>
    </>
  );
}
