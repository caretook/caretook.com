// History state for a link that opens one of the timeline's sheets
// (`timeline/new/…`, `timeline/:entryId/edit`) from a screen the user should
// come back to: the timeline itself, or Upcoming. The sheet closes by going
// back when it's there (`useCloseSheet`), else by replacing itself with the timeline.

/** History state on a link that opens a sheet over the timeline. */
export const SHEET_LINK_STATE = { sheetOverTimeline: true } as const;

/** Whether a sheet was opened by a link carrying `SHEET_LINK_STATE`. */
export const openedOverTimeline = (state: unknown) =>
  typeof state === "object" && state !== null && "sheetOverTimeline" in state;
