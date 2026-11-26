import type { ReactNode } from "react";
import type { LocalProvider, ProviderRow } from "~/lib/providers/providers.sync";

import { Link } from "react-router";
import { PROVIDER_TYPE_ICONS } from "~/components/providers";
import { Badge, DetailHeader, LINK, STATUS_TONE } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { PROVIDER_TYPE_META } from "~/lib/providers/providerDirectory";
import { useLiveQuery } from "~/lib/sync";
import { providerQuery, toProvider } from "~/lib/providers/providers.sync";

const NO_ROWS: ProviderRow[] = [];

/**
 * The provider's header (`DetailHeader`): its type's icon, its name with a
 * Primary or Past badge, and its type, specialty and practice (a link).
 *
 * - `editors`: who is editing the notes now (avatars).
 * - `actions`: Copy to another group, Tags and Edit, for writers.
 * - `tags`: its tag chips, under the details (tags PRD).
 */
export function ProviderHeader({
  provider,
  editors,
  actions,
  tags,
}: {
  provider: LocalProvider;
  editors?: ReactNode;
  actions?: ReactNode;
  tags?: ReactNode;
}) {
  const past = provider.status === "past";
  return (
    <DetailHeader
      icon={PROVIDER_TYPE_ICONS[provider.type]}
      tone={past ? "muted" : "neutral"}
      title={provider.name}
      titleProps={{ "data-provider-name": "" }}
      badges={
        provider.isPrimary && !past ? (
          <Badge tone={STATUS_TONE.current}>Primary</Badge>
        ) : (
          past && <Badge tone={STATUS_TONE.past}>Past</Badge>
        )
      }
      details={
        <>
          {[PROVIDER_TYPE_META[provider.type].label, provider.specialty].filter(Boolean).join(" · ")}
          {provider.practiceId && (
            <>
              {" · "}
              <PracticeLink groupId={provider.groupId} practiceId={provider.practiceId} />
            </>
          )}
          {tags}
        </>
      }
      editors={editors}
      actions={actions}
    />
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
      <span className="text-faint whitespace-nowrap" data-practice>
        {practice.name} (removed)
      </span>
    );
  }
  return (
    <Link to={appUrls.provider(groupId, practice.id)} className={`${LINK} whitespace-nowrap`} data-practice>
      {practice.name}
    </Link>
  );
}
