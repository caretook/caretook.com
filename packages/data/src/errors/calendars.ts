// Calendars (appointments-2): a member's calendar settings, the details
// consent, and the owners' "Details outside Caretook" switch.
export const CALENDARS_ERRORS = {
  "calendarSettingService:notMember": {
    message: "Care group not found",
    statusCode: 404,
  },
  "calendarSettingService:invalid": {
    message: "These calendar settings can't be saved as they are",
    statusCode: 400,
  },
  "calendarSettingService:detailsForbidden": {
    message: "Your group's owners keep details private",
    statusCode: 403,
  },
  "calendarSettingService:detailsOwnerOnly": {
    message: "Only an owner can change whether details may leave Caretook",
    statusCode: 403,
  },
  "calendarSettingService:badUnsubscribe": {
    message: "This unsubscribe link isn't valid",
    statusCode: 404,
  },
  "calendarReminderService:query": {
    message: "Failed to read what reminders are due",
  },
  "calendarReminderService:noKey": {
    message: "Reminder emails need INVITE_LINK_KEY for their unsubscribe links",
  },
  "memberCalendarSettingModel:removeForMember": {
    message: "Failed to delete the member's calendar settings",
  },
} as const;
