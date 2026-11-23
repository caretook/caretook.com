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
  // Slice 2: medications.
  "components/medications/AllergiesRegion.tsx",
  "components/medications/DoseSlotRow.tsx",
  "components/medications/MedicationStatusActions.tsx",
  "components/medications/PassCard.tsx",
  "components/medications/PassUndoStatus.tsx",
  "components/schedule/RescheduleSheet.tsx",
  "components/schedule/ScheduleFields.tsx",
  "routes/app/groups/medication/MedicationDetails.tsx",
  "routes/app/groups/medication/route.tsx",
  "routes/app/groups/medications/AsNeededRow.tsx",
  "routes/app/groups/medications/MedicationForm.tsx",
  "routes/app/groups/medications/MedicationListItem.tsx",
  "routes/app/groups/medications/PrintMenu.tsx",
  "routes/app/groups/medications/ScheduleFields.tsx",
  "routes/app/groups/medications/allergies/AllergyForm.tsx",
  "routes/app/groups/medications/allergies/AllergyList.tsx",
  "routes/app/groups/medications/allergies/route.tsx",
  "routes/app/groups/medications/passes/PassForm.tsx",
  "routes/app/groups/medications/passes/PassList.tsx",
  "routes/app/groups/medications/print/route.tsx",
  "routes/app/groups/medications/print/week/WeekPicker.tsx",
  "routes/app/groups/medications/print/week/route.tsx",
  // Slice 3: providers and care periods.
  "components/contact/ContactLines.tsx",
  "components/contact/PhoneFields.tsx",
  "components/providers/ContactActions.tsx",
  "routes/app/groups/period/PeriodActions.tsx",
  "routes/app/groups/period/route.tsx",
  "routes/app/groups/periods/PeriodForm.tsx",
  "routes/app/groups/periods/PeriodList.tsx",
  "routes/app/groups/provider/CopyToGroup.tsx",
  "routes/app/groups/provider/ProviderVisitPrep.tsx",
  "routes/app/groups/provider/route.tsx",
  "routes/app/groups/providers/ProviderForm.tsx",
  "routes/app/groups/providers/ProviderListItem.tsx",
  "routes/app/groups/providers/import/ImportList.tsx",
  "routes/app/groups/providers/import/route.tsx",
  // Slice 5: the Planner, to-dos and search.
  "components/repeat/RepeatSheet.tsx",
  "components/repeat/SeriesEditSheet.tsx",
  "components/todos/LinkedTodos.tsx",
  "components/todos/TodoUndoStatus.tsx",
  "components/visitPrep/VisitPrepSheet.tsx",
  "routes/app/groups/planner/PlannerTodoRow.tsx",
  "routes/app/groups/planner/UpcomingRow.tsx",
  "routes/app/groups/planner/UpcomingRowParts.tsx",
  "routes/app/groups/search/ResultItems.tsx",
  "routes/app/groups/todo/TodoActions.tsx",
  "routes/app/groups/todo/TodoCompletion.tsx",
  "routes/app/groups/todo/TodoLinks.tsx",
  "routes/app/groups/todo/route.tsx",
  "routes/app/groups/todos/DoneTodos.tsx",
  "routes/app/groups/todos/TodoForm.tsx",
  "routes/app/groups/todos/TodoRepeat.tsx",
  "routes/app/groups/todos/TodoRow.tsx",
  // ui-kit-5: the timeline, entries, quick entry, admin, account, connectors and the app frame.
  "components/connectors/ConnectGuide.tsx",
  "components/connectors/ask/AskOwners.tsx",
  "components/entry/EntryActions.tsx",
  "components/entry/RemindMeSheet.tsx",
  "components/notes/LiveNotesEditor.tsx",
  "components/quick-entry/QuickEntryBox.tsx",
  "components/quick-entry/QuickEntryCard.tsx",
  "components/quick-entry/QuickEntrySuggestButton.tsx",
  "routes/account/AuthCard.tsx",
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
  "routes/app/groups/entry/EntryCancelledBanner.tsx",
  "routes/app/groups/entry/EntryRepeat.tsx",
  "routes/app/groups/entry/EntryTimeChip.tsx",
  "routes/app/groups/entry/EntryVisitPrep.tsx",
  "routes/app/groups/entry/EntryWithRow.tsx",
  "routes/app/groups/entry/PeriodSuggestionChip.tsx",
  "routes/app/groups/entry/ShareButton.tsx",
  "routes/app/groups/entry/route.tsx",
  "routes/app/groups/new/route.tsx",
  "routes/app/groups/timeline/DoseForm.tsx",
  "routes/app/groups/timeline/EasyNow.tsx",
  "routes/app/groups/timeline/EasyTiles.tsx",
  "routes/app/groups/timeline/EntryForm.tsx",
  "routes/app/groups/timeline/EntryKindPicker.tsx",
  "routes/app/groups/timeline/FeelingFields.tsx",
  "routes/app/groups/timeline/FilterSheet.tsx",
  "routes/app/groups/timeline/InviteSomeoneCard.tsx",
  "routes/app/groups/timeline/LiveNowBanner.tsx",
  "routes/app/groups/timeline/QuickAddMenu.tsx",
  "routes/app/groups/timeline/RemoveLastEntry.tsx",
  "routes/app/groups/timeline/TimelineEntryList.tsx",
  "routes/app/groups/timeline/TimelineEntryRow.tsx",
  "routes/app/groups/timeline/TimelineFilters.tsx",
  "routes/app/groups/timeline/TodayMedicationsRow.tsx",
  "routes/app/groups/timeline/VitalReadingRow.tsx",
  "routes/app/groups/timeline/VitalReadingsFields.tsx",
  "routes/app/groups/timeline/pass/PassLogForm.tsx",
  "routes/app/home/NewGroupLink.tsx",
  "routes/app/home/PendingRequests.tsx",
  "routes/app/home/route.tsx",
  "routes/app/layout/GroupMenu.tsx",
  "routes/app/layout/SectionNav.tsx",
  "routes/app/layout/SyncIndicator.tsx",
  "routes/app/layout/UserMenu.tsx",
  "routes/app/layout/route.tsx",
  "routes/connectors/connect/ConnectConsent.tsx",
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
