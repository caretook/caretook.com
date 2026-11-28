import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Secrets kept at rest (server only): AES-256-GCM through Node's crypto,
// with a row's id as associated data, so a sealed value only opens on its
// own row. Invite links (`linkToken.ts`, INVITE_LINK_KEY) and Google refresh
// tokens (`googleToken.ts`, GOOGLE_TOKEN_KEY) use it.

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * A local check build (`risa serve --built`: VITE_CHECK_BUILD=1 and a
 * localhost APP_URL) runs with NODE_ENV=production but is a dev server in
 * every other way, so it may use a dev key (as @caretook/notifications'
 * `isCheckBuild` lets it use the dev mailbox).
 */
export const isLocalCheckBuild = (env: NodeJS.ProcessEnv) => {
  if (env.VITE_CHECK_BUILD !== "1") return false;
  try {
    return ["localhost", "127.0.0.1"].includes(new URL(env.APP_URL?.trim() ?? "").hostname);
  } catch {
    return false;
  }
};

/**
 * The 32-byte key from a configured value (any length; hashed), the dev key
 * outside production, or null in production without one.
 */
export const sealingKey = (configured: string | undefined, devKey: string, env: NodeJS.ProcessEnv) => {
  const value = configured?.trim();
  if (!value && env.NODE_ENV === "production" && !isLocalCheckBuild(env)) return null;
  return createHash("sha256")
    .update(value || devKey)
    .digest();
};

/** `text` encrypted under `key` for row `aad`, as base64url(iv | tag | ciphertext). */
export const sealWith = (key: Buffer, text: string, aad: string) => {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from(aad));
  const body = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
};

/** The text sealed for `aad`, or null when it doesn't open (another key, another row, tampered). */
export const openWith = (key: Buffer, sealed: string, aad: string) => {
  try {
    const raw = Buffer.from(sealed, "base64url");
    if (raw.length <= IV_BYTES + TAG_BYTES) return null;
    const decipher = createDecipheriv(ALGORITHM, key, raw.subarray(0, IV_BYTES));
    decipher.setAAD(Buffer.from(aad));
    decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    return Buffer.concat([decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    return null;
  }
};
