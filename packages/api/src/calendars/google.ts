import { googleConnectionService } from "@caretook/data";
import { z } from "zod";
import { unwrap } from "../errors";
import { authedProcedure } from "../procedures";

// Google Calendar (appointments-2, slice 7), for the Calendar & reminders
// page's Google card: the member's own connection's status (never a token)
// and Disconnect. Connecting goes through the web-only `/api/google/connect`
// and `/api/google/callback` routes, since it leaves for Google's consent page.

const groupId = z.uuid();

export const google = {
  /** The caller's Google connection for a group they're in: connected or not, last synced, any error. */
  status: authedProcedure
    .input(z.object({ groupId }))
    .handler(async ({ context, input }) =>
      unwrap(await googleConnectionService.status(context, input.groupId)),
    ),
  /** Disconnect: revoke and forget the token, stop syncing; the calendar stays in Google. */
  disconnect: authedProcedure
    .input(z.object({ groupId }))
    .handler(async ({ context, input }) =>
      unwrap(await googleConnectionService.disconnect(context, input.groupId)),
    ),
};
