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
  "calendarFeedService:notMember": {
    message: "Care group not found",
    statusCode: 404,
  },
  "calendarFeedService:exists": {
    message: "You already have a calendar feed for this group. Regenerate it to get a new link",
    statusCode: 409,
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
  // Google Calendar (slice 7): connecting, the push, and the Google client's
  // own failures (returned, never thrown; never carrying a token).
  "googleConnectionService:notMember": {
    message: "Care group not found",
    statusCode: 404,
  },
  "googleConnectionService:notConfigured": {
    message: "Google Calendar isn't set up here",
  },
  "googleConnectionService:keyMissing": {
    message: "Google Calendar can't keep its sign-in safely here (GOOGLE_TOKEN_KEY is missing)",
  },
  "googleConnectionService:badState": {
    message: "That Google sign-in has expired or isn't yours. Try Connect again.",
    statusCode: 400,
  },
  "googleConnectionService:notConnected": {
    message: "Google Calendar isn't connected for this group",
    statusCode: 404,
  },
  "googleConnectionService:noRefreshToken": {
    message: "Google didn't give Caretook lasting access. Try Connect again.",
    statusCode: 400,
  },
  "googleConnectionService:db": {
    message: "Failed to read or write the Google connection",
  },
  "calendarSyncService:db": {
    message: "Failed to read or write the calendar sync jobs",
  },
  "googleCalendar:revoked": {
    message: "Google refused the connection's access (revoked or expired)",
  },
  "googleCalendar:notFound": {
    message: "Google has no such calendar or event",
  },
  "googleCalendar:failed": {
    message: "A call to Google Calendar failed",
  },
} as const;
