import { createHmac, timingSafeEqual } from "node:crypto";
import { linkSubkey } from "./linkToken";

// The one-click unsubscribe link in reminder emails (appointments-2 slice 6):
// `<user>.<group>.<signature>`, an HMAC-SHA256 over the user and group under
// a key derived from INVITE_LINK_KEY. It never expires (an unsubscribe link
// must keep working) and only turns that member's reminders off in that
// group, so nothing is stored. Server only.

const PURPOSE = "reminders-unsubscribe";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const signature = (key: Buffer, userId: string, groupId: string) =>
  createHmac("sha256", key).update(`${userId}:${groupId}`).digest();

/** The token for `userId`'s reminders in `groupId`, or null without a key (production without INVITE_LINK_KEY). */
export const reminderUnsubscribeToken = (userId: string, groupId: string, env?: NodeJS.ProcessEnv) => {
  const key = linkSubkey(PURPOSE, env);
  if (!key) return null;
  return `${userId}.${groupId}.${signature(key, userId, groupId).toString("base64url")}`;
};

/** The user and group a token was made for, or null when it isn't one of ours. */
export const readReminderUnsubscribeToken = (token: string, env?: NodeJS.ProcessEnv) => {
  const key = linkSubkey(PURPOSE, env);
  const [userId, groupId, sig, ...rest] = token.split(".");
  if (!key || !userId || !groupId || !sig || rest.length || !UUID.test(userId) || !UUID.test(groupId))
    return null;
  const given = Buffer.from(sig, "base64url");
  const expected = signature(key, userId, groupId);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return { userId, groupId };
};
