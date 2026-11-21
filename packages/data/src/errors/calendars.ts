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
  "memberCalendarSettingModel:removeForMember": {
    message: "Failed to delete the member's calendar settings",
  },
} as const;
