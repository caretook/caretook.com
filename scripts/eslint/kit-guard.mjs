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
  // ui-kit-5 slice 2: timeline forms and sheets.
  "routes/app/groups/timeline/DoseForm.tsx",
  "routes/app/groups/timeline/EntryForm.tsx",
  "routes/app/groups/timeline/EntryKindPicker.tsx",
  "routes/app/groups/timeline/FeelingFields.tsx",
  "routes/app/groups/timeline/QuickAddMenu.tsx",
  "routes/app/groups/timeline/VitalReadingRow.tsx",
  "routes/app/groups/timeline/VitalReadingsFields.tsx",
  "routes/app/groups/timeline/pass/PassLogForm.tsx",
  // ui-kit-5 slice 3: Easy view and quick entry.
  "components/quick-entry/QuickEntryBox.tsx",
  "components/quick-entry/QuickEntryCard.tsx",
  "components/quick-entry/QuickEntrySuggestButton.tsx",
  "routes/app/groups/timeline/EasyNow.tsx",
  "routes/app/groups/timeline/EasyTiles.tsx",
  // ui-kit-5 slice 4: entries and the notes editor.
  "components/entry/EntryActions.tsx",
  "components/entry/RemindMeSheet.tsx",
  "components/notes/LiveNotesEditor.tsx",
  "routes/app/groups/entry/EntryCancelledBanner.tsx",
  "routes/app/groups/entry/EntryRepeat.tsx",
  "routes/app/groups/entry/EntryTimeChip.tsx",
  "routes/app/groups/entry/EntryVisitPrep.tsx",
  "routes/app/groups/entry/EntryWithRow.tsx",
  "routes/app/groups/entry/PeriodSuggestionChip.tsx",
  "routes/app/groups/entry/ShareButton.tsx",
  "routes/app/groups/entry/route.tsx",
  // ui-kit-5 slice 5: admin.
  "routes/admin/AccountBadges.tsx",
  "routes/admin/access-codes/route.tsx",
  "routes/admin/audit/AuditFilterForm.tsx",
  "routes/admin/audit/route.tsx",
  "routes/admin/group/InviteOwnerForm.tsx",
  "routes/admin/group/MemberList.tsx",
  "routes/admin/group/route.tsx",
  "routes/admin/groups/route.tsx",
  "routes/admin/new-group/route.tsx",
  "routes/admin/settings/SettingCard.tsx",
  "routes/admin/settings/route.tsx",
  "routes/admin/suppressions/ClearSuppression.tsx",
  "routes/admin/suppressions/SuppressionsPage.tsx",
  "routes/admin/user/AccountAdminActions.tsx",
  "routes/admin/user/AccountSections.tsx",
  "routes/admin/user/HelpAction.tsx",
  "routes/admin/user/route.tsx",
  "routes/admin/users/route.tsx",
  "routes/admin/waitlist/WaitlistFilterForm.tsx",
  "routes/admin/waitlist/route.tsx",
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
