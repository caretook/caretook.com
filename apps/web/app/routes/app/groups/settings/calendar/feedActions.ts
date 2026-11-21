import type { ActionResult } from "~/lib/core/api";
import type { CardAction } from "./calendarPage";

import { rpc } from "~/lib/core/rpc";

// The Calendar feed card's posts (calendars, appointments-2 slice 5): make,
// replace and stop the member's feed through `calendars.feed.*`. Making or
// replacing it answers with the new URL, which is shown once: only its hash
// is kept on the server.

/** What the feed's posts answer: `feedUrl` after a create or regenerate. */
export type FeedActionResult = ActionResult & { feedUrl?: string };

const create: CardAction = async ({ groupId }): Promise<FeedActionResult> => {
  const { url } = await rpc.calendars.feed.create({ groupId });
  return { ok: true, feedUrl: url };
};

const rotate: CardAction = async ({ groupId }): Promise<FeedActionResult> => {
  const { url } = await rpc.calendars.feed.rotate({ groupId });
  return { ok: true, feedUrl: url };
};

const revoke: CardAction = async ({ groupId }): Promise<FeedActionResult> => {
  await rpc.calendars.feed.revoke({ groupId });
  return { ok: true };
};

export const FEED_ACTIONS = { feedCreate: create, feedRotate: rotate, feedRevoke: revoke } as const;
