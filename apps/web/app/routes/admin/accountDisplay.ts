// How accounts read in /admin (the Users list and an account's page):
// badges, roles, devices and times. Pure, tested.

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

const BROWSERS: [RegExp, string][] = [
  [/\bEdg(?:e|A|iOS)?\//, "Edge"],
  [/\b(?:OPR|Opera)\//, "Opera"],
  [/\b(?:Firefox|FxiOS)\//, "Firefox"],
  [/\b(?:HeadlessChrome|Chrome|CriOS|Chromium)\//, "Chrome"],
  [/\bVersion\/[\d.]+.*\bSafari\//, "Safari"],
];

const SYSTEMS: [RegExp, string][] = [
  [/\biPhone\b/, "iPhone"],
  [/\biPad\b/, "iPad"],
  [/\bAndroid\b/, "Android"],
  [/\bCrOS\b/, "ChromeOS"],
  [/\bMac OS X\b|\bMacintosh\b/, "Mac"],
  [/\bWindows\b/, "Windows"],
  [/\bLinux\b/, "Linux"],
];

/**
 * A session's device from its user agent: "Chrome on Mac", "Safari on
 * iPhone", "the Caretook app on Android" (a WebView), or what's known.
 */
export const deviceLabel = (userAgent: string | null | undefined) => {
  if (!userAgent?.trim()) return "Unknown device";
  const system = SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1];
  const webView =
    /; wv\)/.test(userAgent) || (/\b(?:iPhone|iPad)\b/.test(userAgent) && !/Safari\//.test(userAgent));
  const browser = webView ? "the Caretook app" : BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1];
  if (browser && system) return `${browser} on ${system}`;
  return browser ?? system ?? "Unknown device";
};

/** A moment, in UTC (staff work across zones). */
export const adminTime = (iso: string | null | undefined) =>
  iso
    ? `${new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC`
    : "—";

/** A day, in UTC. */
export const adminDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" });

/** A group role's label. */
export const groupRoleLabel = (role: string) =>
  ({ owner: "Owner", admin: "Admin", caretaker: "Caretaker", viewer: "Viewer" })[role] ?? role;

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
