// @ts-check
// The lists of `caretook/no-kit-classes` (plugin.mjs). Paths are relative to apps/web/app/.

/** Raw kit classes are right here, for good. A path ending in `/` covers its folder. */
export const KIT_CLASSES_ALLOWED = [
  "components/ui/",
  "lib/marketing/",
  "routes/marketing/",
  "routes/dev/ui/",
  // The printed sheets, by exact path: on-screen controls beside them (WeekPicker, PrintMenu) are guarded.
  "components/medications/PrintAllergies.tsx",
  "components/medications/PrintConditions.tsx",
  "routes/admin/access-codes-print/route.tsx",
  "routes/app/groups/entry/EntryPrintView.tsx",
  "routes/app/groups/medications/print/MedicationSheet.tsx",
  "routes/app/groups/medications/print/week/WeeklyChart.tsx",
  "routes/app/groups/profile/print/EmergencySheet.tsx",
];

/** Areas with hits today. A sweep's last step deletes its group; `ui-kit-5` empties the list. */
/** @type {string[]} */
export const KIT_CLASSES_NOT_SWEPT = [
  // ui-kit-5 slice 6: account and connectors.
  "components/connectors/ConnectGuide.tsx",
  "components/connectors/ask/AskOwners.tsx",
  "routes/account/AuthCard.tsx",
  "routes/connectors/connect/ConnectConsent.tsx",
  // ui-kit-5 slice 7: the frame, home and the new group page.
  "routes/app/groups/new/route.tsx",
  "routes/app/home/NewGroupLink.tsx",
  "routes/app/home/PendingRequests.tsx",
  "routes/app/home/route.tsx",
  "routes/app/layout/GroupMenu.tsx",
  "routes/app/layout/SectionNav.tsx",
  "routes/app/layout/SyncIndicator.tsx",
  "routes/app/layout/UserMenu.tsx",
  "routes/app/layout/route.tsx",
  "routes/dev/mail/list/route.tsx",
];

/** The path under apps/web/app/, or null for a file outside it. */
export const appPath = (/** @type {string} */ filename) => {
  const path = filename.replaceAll("\\", "/");
  const at = path.lastIndexOf("apps/web/app/");
  return at === -1 ? null : path.slice(at + "apps/web/app/".length);
};

/** Whether the rule skips this file: on either list, or outside the web app. */
export function isKitClassExempt(/** @type {string} */ filename) {
  const path = appPath(filename);
  if (path === null) return true;
  const listed = (/** @type {string} */ entry) =>
    entry.endsWith("/") ? path.startsWith(entry) : path === entry;
  return KIT_CLASSES_ALLOWED.some(listed) || KIT_CLASSES_NOT_SWEPT.includes(path);
}
