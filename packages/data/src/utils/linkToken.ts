import { createHmac } from "node:crypto";

import { openWith, sealingKey, sealWith } from "./seal";

// Invite links keep their raw token encrypted at rest, so owners and admins
// can copy an active link again (`invite.copyLink`). Email invites never do:
// only their hash is stored. AES-256-GCM (`seal.ts`), keyed by
// INVITE_LINK_KEY, with the invite's id as associated data, so a sealed
// token only opens on its own row. Server only.

/** Outside production and staging only, so local dev, seeds and tests work without setup. */
const DEV_KEY = "caretook-dev-invite-link-key (never in production)";

/**
 * The 32-byte key from INVITE_LINK_KEY (any length; hashed), or null in
 * production or a deployed APP_ENV (staging's seed runs without
 * NODE_ENV=production) without one: links sealed there with the dev key
 * wouldn't open on the server, which has the real key (B-830).
 */
const linkKey = (env: NodeJS.ProcessEnv = process.env) => {
  const deployed = ["staging", "production"].includes(env.APP_ENV?.trim() ?? "");
  if (deployed && !env.INVITE_LINK_KEY?.trim()) return null;
  return sealingKey(env.INVITE_LINK_KEY, DEV_KEY, env);
};

/**
 * A key for another purpose ("reminders-unsubscribe"), derived from the same
 * secret so nothing new needs configuring: HMAC-SHA256(key, purpose). Null
 * where `linkKey` is (production or staging without INVITE_LINK_KEY).
 */
export const linkSubkey = (purpose: string, env: NodeJS.ProcessEnv = process.env) => {
  const key = linkKey(env);
  return key ? createHmac("sha256", key).update(purpose).digest() : null;
};

/** Whether links can be sealed here (production and staging need INVITE_LINK_KEY). */
export const linkKeyConfigured = (env: NodeJS.ProcessEnv = process.env) => linkKey(env) !== null;

/** `token` encrypted for invite `inviteId`, as base64url(iv | tag | ciphertext); null without a key. */
export const sealLinkToken = (token: string, inviteId: string, env?: NodeJS.ProcessEnv) => {
  const key = linkKey(env);
  return key ? sealWith(key, token, inviteId) : null;
};

/** The token sealed for `inviteId`, or null when it doesn't open (another key, another row, tampered). */
export const openLinkToken = (sealed: string, inviteId: string, env?: NodeJS.ProcessEnv) => {
  const key = linkKey(env);
  return key ? openWith(key, sealed, inviteId) : null;
};
