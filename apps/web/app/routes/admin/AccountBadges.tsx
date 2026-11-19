import { accountBadges } from "./accountDisplay";

// An account's badges (confirmed or not, disabled, staff role), on the Users
// list and an account's page.

const TONES = {
  success: "badge-success",
  warning: "badge-warning",
  error: "badge-error",
  info: "badge-info",
} as const;

export function AccountBadges({
  account,
}: {
  account: { emailVerified: boolean; disabled: boolean; role: string };
}) {
  return (
    <span className="flex flex-wrap gap-1">
      {accountBadges(account).map((badge) => (
        <span
          key={badge.id}
          className={`badge badge-sm badge-soft ${TONES[badge.tone]}`}
          data-badge={badge.id}
        >
          {badge.label}
        </span>
      ))}
    </span>
  );
}
