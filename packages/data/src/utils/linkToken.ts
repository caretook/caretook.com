import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

// Invite links keep their raw token encrypted at rest, so owners and admins
// can copy an active link again (`invite.copyLink`). Email invites never do:
// only their hash is stored. AES-256-GCM through Node's crypto, keyed by
// INVITE_LINK_KEY, with the invite's id as associated data, so a sealed
// token only opens on its own row. Server only.

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
/** Outside production only, so dev, seeds and tests work without setup. */
const DEV_KEY = "caretook-dev-invite-link-key (never in production)";

/**
 * A local check build (`pnpm prd serve --built`: VITE_CHECK_BUILD=1 and a
 * localhost APP_URL) runs with NODE_ENV=production but is a dev server in
 * every other way, so it may use the dev key (as @caretook/notifications'
 * `isCheckBuild` lets it use the dev mailbox).
 */
const isLocalCheckBuild = (env: NodeJS.ProcessEnv) => {
  if (env.VITE_CHECK_BUILD !== "1") return false;
  try {
    return ["localhost", "127.0.0.1"].includes(new URL(env.APP_URL?.trim() ?? "").hostname);
  } catch {
    return false;
  }
};

/** The 32-byte key from INVITE_LINK_KEY (any length; hashed), or null in production without one. */
const linkKey = (env: NodeJS.ProcessEnv = process.env) => {
  const configured = env.INVITE_LINK_KEY?.trim();
  if (!configured && env.NODE_ENV === "production" && !isLocalCheckBuild(env)) return null;
  return createHash("sha256")
    .update(configured || DEV_KEY)
    .digest();
};

/**
 * A key for another purpose ("reminders-unsubscribe"), derived from the same
 * secret so nothing new needs configuring: HMAC-SHA256(key, purpose). Null
 * where `linkKey` is (production without INVITE_LINK_KEY).
 */
export const linkSubkey = (purpose: string, env: NodeJS.ProcessEnv = process.env) => {
  const key = linkKey(env);
  return key ? createHmac("sha256", key).update(purpose).digest() : null;
};

/** Whether links can be sealed here (production needs INVITE_LINK_KEY). */
export const linkKeyConfigured = (env: NodeJS.ProcessEnv = process.env) => linkKey(env) !== null;

/** `token` encrypted for invite `inviteId`, as base64url(iv | tag | ciphertext); null without a key. */
export const sealLinkToken = (token: string, inviteId: string, env?: NodeJS.ProcessEnv) => {
  const key = linkKey(env);
  if (!key) return null;
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from(inviteId));
  const body = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
};

/** The token sealed for `inviteId`, or null when it doesn't open (another key, another row, tampered). */
export const openLinkToken = (sealed: string, inviteId: string, env?: NodeJS.ProcessEnv) => {
  const key = linkKey(env);
  if (!key) return null;
  try {
    const raw = Buffer.from(sealed, "base64url");
    if (raw.length <= IV_BYTES + TAG_BYTES) return null;
    const decipher = createDecipheriv(ALGORITHM, key, raw.subarray(0, IV_BYTES));
    decipher.setAAD(Buffer.from(inviteId));
    decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    return Buffer.concat([decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    return null;
  }
};
