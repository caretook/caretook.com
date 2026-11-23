import { Badge } from "~/components/ui";
import { accountBadges } from "./accountDisplay";

// An account's badges (confirmed or not, disabled, staff role), on the Users
// list and an account's page.

const TONES = { success: "success", warning: "warning", error: "danger", info: "info" } as const;

export function AccountBadges({
  account,
}: {
  account: { emailVerified: boolean; disabled: boolean; role: string };
}) {
  return (
    <span className="flex flex-wrap gap-1">
      {accountBadges(account).map((badge) => (
        <Badge key={badge.id} tone={TONES[badge.tone]} data-badge={badge.id}>
          {badge.label}
        </Badge>
      ))}
    </span>
  );
}
