// How accounts read in /admin (the Users list and an account's page):
// badges, roles and times. Pure, tested.

/** A staff role's label, or null for a member (no badge). */
export const staffRoleLabel = (role: string) =>
  role === "admin" ? "Admin" : role === "support" ? "Support" : null;

/** The badges beside an account: confirmed or not, disabled, staff role. */
export const accountBadges = (account: { emailVerified: boolean; disabled: boolean; role: string }) => {
  const badges: { id: string; label: string; tone: "success" | "warning" | "error" | "info" }[] = [];
  badges.push(
    account.emailVerified
      ? { id: "verified", label: "Confirmed", tone: "success" }
      : { id: "unverified", label: "Not confirmed", tone: "warning" },
  );
  if (account.disabled) badges.push({ id: "disabled", label: "Disabled", tone: "error" });
  const staff = staffRoleLabel(account.role);
  if (staff) badges.push({ id: "staff", label: staff, tone: "info" });
  return badges;
};

/** A moment, in UTC (staff work across zones). */
export const adminTime = (iso: string | null | undefined) =>
  iso
    ? `${new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC`
    : "—";

/** A day, in UTC. */
export const adminDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" });

/** How an outbox row's status reads. */
export const mailStatusLabel = (status: string) =>
  ({
    pending: "Waiting",
    sending: "Sending",
    sent: "Sent",
    skipped: "Not sent",
    failed: "Failed",
    bounced: "Bounced",
    complained: "Marked as spam",
  })[status] ?? status;
