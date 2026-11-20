import { History } from "lucide-react";
import { Link } from "react-router";
import { appUrls } from "~/lib/app-shell/appUrls";
import { recordSearch, useRecentSearches } from "~/lib/search/recentSearches";

/**
 * What the empty search page offers: this device's last few searches (one
 * tap runs one again) and one line on the query language.
 */
export function RecentSearches({ groupId, userId }: { groupId: string; userId: string }) {
  const recent = useRecentSearches(userId);
  return (
    <div className="space-y-4">
      {recent.length > 0 && (
        <section aria-labelledby="recent-searches" data-recent-searches>
          <h2 id="recent-searches" className="mb-1 px-1 font-semibold">
            Recent searches
          </h2>
          <ul className="divide-base-300 border-base-300 divide-y rounded-box border">
            {recent.map((q) => (
              <li key={q}>
                <Link
                  to={appUrls.search(groupId, q)}
                  replace
                  preventScrollReset
                  onClick={() => recordSearch(userId, q)}
                  className="hover:bg-base-200/50 flex items-center gap-3 rounded-[inherit] px-3 py-2.5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                  data-recent-search={q}
                >
                  <History className="size-4 shrink-0 opacity-60" aria-hidden="true" />
                  <span className="min-w-0 truncate">{q}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-base-content/70 px-1 text-sm" data-search-tips>
        Tip: put a phrase in &ldquo;quotes&rdquo;, and use -word to leave out entries with that word.
      </p>
    </div>
  );
}
