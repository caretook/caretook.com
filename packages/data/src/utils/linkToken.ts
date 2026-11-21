import { openWith, sealingKey, sealWith } from "./seal";

// Invite links keep their raw token encrypted at rest, so owners and admins
// can copy an active link again (`invite.copyLink`). Email invites never do:
// only their hash is stored. AES-256-GCM (`seal.ts`), keyed by
// INVITE_LINK_KEY, with the invite's id as associated data, so a sealed
// token only opens on its own row. Server only.

/** Outside production only, so dev, seeds and tests work without setup. */
const DEV_KEY = "caretook-dev-invite-link-key (never in production)";

/** The 32-byte key from INVITE_LINK_KEY (any length; hashed), or null in production without one. */
const linkKey = (env: NodeJS.ProcessEnv = process.env) => sealingKey(env.INVITE_LINK_KEY, DEV_KEY, env);

/** Whether links can be sealed here (production needs INVITE_LINK_KEY). */
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
