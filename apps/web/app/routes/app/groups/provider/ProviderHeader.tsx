import type { ReactNode } from "react";
import type { LocalProvider, ProviderRow } from "~/lib/providers/providers.sync";

import { Link } from "react-router";
import { ProviderTypeIcon } from "~/components/providers";
import { appUrls } from "~/lib/app-shell/appUrls";
import { PROVIDER_TYPE_META } from "~/lib/providers/providerDirectory";
import { useLiveQuery } from "~/lib/sync";
import { providerQuery, toProvider } from "~/lib/providers/providers.sync";

const NO_ROWS: ProviderRow[] = [];

/**
 * The provider's header, in regions like `EntryHeader`'s:
 *
 *   [icon] [name, badges ......] [editors] [actions]
 *          [type · specialty · practice]
 *
 * - `editors`: who is editing the notes now (avatars).
 * - `actions`: Edit, for writers (empty until the edit sheet lands).
 *
 * Empty regions take no space.
 */
export function ProviderHeader({
  provider,
  editors,
  actions,
}: {
  provider: LocalProvider;
  editors?: ReactNode;
  actions?: ReactNode;
}) {
  const past = provider.status === "past";
  return (
    <header className="flex items-start gap-3">
      <ProviderTypeIcon type={provider.type} past={past} />
      <div className="min-w-0 flex-1 space-y-0.5">
        <div data-region="title" className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h1 className="text-xl font-semibold break-words" data-provider-name>
            {provider.name}
          </h1>
          {provider.isPrimary && !past && <span className="badge badge-primary badge-sm">Primary</span>}
          {past && <span className="badge badge-ghost badge-sm">Past</span>}
        </div>
        <p data-region="details" className="text-base-content/70 text-sm">
          {[PROVIDER_TYPE_META[provider.type].label, provider.specialty].filter(Boolean).join(" · ")}
          {provider.practiceId && (
            <>
              {" · "}
              <PracticeLink groupId={provider.groupId} practiceId={provider.practiceId} />
            </>
          )}
        </p>
      </div>
      {editors && (
        <div data-region="editors" className="flex shrink-0 items-center -space-x-1.5 pt-1">
          {editors}
        </div>
      )}
      {actions && (
        <div data-region="actions" className="flex shrink-0 items-center gap-1">
          {actions}
        </div>
      )}
    </header>
  );
}

/** The clinician's practice, linking to its page; greyed and unlinked once it's deleted. */
function PracticeLink({ groupId, practiceId }: { groupId: string; practiceId: string }) {
  const query = providerQuery(practiceId);
  const rows = useLiveQuery<ProviderRow>(query.sql, query.params, NO_ROWS);
  const practice = rows[0] ? toProvider(rows[0]) : null;
  if (!practice || practice.groupId !== groupId) return null;
  if (practice.deletedAt) {
    return (
      <span className="text-base-content/50 whitespace-nowrap" data-practice>
        {practice.name} (removed)
      </span>
    );
  }
  return (
    <Link to={appUrls.provider(groupId, practice.id)} className="link whitespace-nowrap" data-practice>
      {practice.name}
    </Link>
  );
}
