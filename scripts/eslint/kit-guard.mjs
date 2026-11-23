// @ts-check
// The list of `caretook/no-kit-classes` (plugin.mjs). Paths are relative to apps/web/app/.

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

/** The path under apps/web/app/, or null for a file outside it. */
export const appPath = (/** @type {string} */ filename) => {
  const path = filename.replaceAll("\\", "/");
  const at = path.lastIndexOf("apps/web/app/");
  return at === -1 ? null : path.slice(at + "apps/web/app/".length);
};

/** Whether the rule skips this file: on the list, or outside the web app. */
export function isKitClassExempt(/** @type {string} */ filename) {
  const path = appPath(filename);
  if (path === null) return true;
  const listed = (/** @type {string} */ entry) =>
    entry.endsWith("/") ? path.startsWith(entry) : path === entry;
  return KIT_CLASSES_ALLOWED.some(listed);
}
