import { calendarFeedService } from "@caretook/data";
import { getMailConfig } from "@caretook/notifications";
import { z } from "zod";
import { unwrap } from "../errors";
import { authedProcedure } from "../procedures";
import { feedUrl } from "./feed";

// The member's calendar feed (appointments-2, slice 5): any member, viewers
// included, makes, replaces and stops their own. The URL is returned only
// by `create` and `rotate`, once: only its hash is kept.

const input = z.object({ groupId: z.uuid() });

export const feed = {
  /** Make the caller's feed for a group; refused when they have one (regenerate it instead). */
  create: authedProcedure.input(input).handler(async ({ context, input: { groupId } }) => {
    const { token } = unwrap(await calendarFeedService.create(context, groupId));
    return { url: feedUrl(getMailConfig().appUrl, token) };
  }),
  /** A new link in place of the old one, which stops working. */
  rotate: authedProcedure.input(input).handler(async ({ context, input: { groupId } }) => {
    const { token } = unwrap(await calendarFeedService.rotate(context, groupId));
    return { url: feedUrl(getMailConfig().appUrl, token) };
  }),
  /** Stop the feed: its link answers 404. */
  revoke: authedProcedure
    .input(input)
    .handler(async ({ context, input: { groupId } }) =>
      unwrap(await calendarFeedService.revoke(context, groupId)),
    ),
};
