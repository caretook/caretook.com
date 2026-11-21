import type { CardAction } from "./calendarPage";

import { rpc } from "~/lib/core/rpc";

/** The Google card's Disconnect (`intent: googleDisconnect`): the calendar stays in Google. */
export const googleDisconnect: CardAction = async ({ groupId }) => {
  await rpc.calendars.google.disconnect({ groupId });
  return { ok: true };
};
