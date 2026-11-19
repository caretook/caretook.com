import type { RecipientProfileRow } from "~/lib/sync/profile";

import { ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { UserAvatar } from "~/components/ui";
import { appUrls } from "~/lib/appUrls";
import { useGroup } from "~/lib/group";
import { ageText, codeStatusLabel } from "~/lib/recipientDisplay";
import { useRecipientProfile } from "~/lib/sync/profile";

// One array for every render: `useLiveQuery` treats a new `initial` as new loader data.
const NO_ROWS: RecipientProfileRow[] = [];

/**
 * The timeline header's recipient card (profiles): the recipient's avatar
 * and name as the page's heading, with their age and code status when set
 * and the group's name, all one link to their profile (stretched over the
 * card). Without a recipient it's the group's name, with no link.
 */
export function RecipientCard() {
  const group = useGroup();
  const profile = useRecipientProfile(group.id, NO_ROWS);
  const name = profile?.displayName || group.displayName;
  const facts = profile
    ? [ageText(profile.dateOfBirth, profile.timeZone, new Date()), codeStatusLabel(profile.codeStatus)]
    : [];
  const subtitle = (
    <p className="text-base-content/70 truncate text-sm">
      {[group.name, ...facts].filter(Boolean).join(" · ")}
      {group.role === "viewer" && " · You can view this timeline"}
    </p>
  );
  if (!group.recipient)
    return (
      <div className="min-w-0">
        <h1 className="text-lg font-semibold">{name}</h1>
        {subtitle}
      </div>
    );
  return (
    <div
      className="rounded-box hover:bg-base-200 focus-within:bg-base-200 relative -mx-2 -my-1 flex min-w-0 items-center gap-3 px-2 py-1"
      data-recipient-card=""
    >
      <UserAvatar name={name} size="lg" />
      <div className="min-w-0">
        <h1 className="text-lg font-semibold">
          <Link
            to={appUrls.profile(group.id)}
            className="after:absolute after:inset-0 focus-visible:outline-none"
            aria-label={`${name}'s profile`}
            data-profile-link=""
          >
            {name}
          </Link>
        </h1>
        {subtitle}
      </div>
      <ChevronRight className="text-base-content/50 size-4 shrink-0" aria-hidden="true" />
    </div>
  );
}
