import { openWith, sealingKey, sealWith } from "./seal";

// Google refresh tokens (and a Connect's PKCE verifier) at rest
// (appointments-2): AES-256-GCM (`seal.ts`) under GOOGLE_TOKEN_KEY, with the
// row's id (the connection's, or the OAuth state's) as associated data.
// Production refuses to connect without the key; dev and tests use a fixed
// one. Server only; a sealed or opened token is never logged.

/** Outside production only, so dev and tests work without setup. */
const DEV_KEY = "caretook-dev-google-token-key (never in production)";

const googleKey = (env: NodeJS.ProcessEnv = process.env) => sealingKey(env.GOOGLE_TOKEN_KEY, DEV_KEY, env);

/** Whether Google tokens can be sealed here (production needs GOOGLE_TOKEN_KEY). */
export const googleTokenKeyConfigured = (env: NodeJS.ProcessEnv = process.env) => googleKey(env) !== null;

/** `token` sealed for row `rowId`; null without a key. */
export const sealGoogleToken = (token: string, rowId: string, env?: NodeJS.ProcessEnv) => {
  const key = googleKey(env);
  return key ? sealWith(key, token, rowId) : null;
};

/** The token sealed for `rowId`, or null when it doesn't open (another key, another row, tampered). */
export const openGoogleToken = (sealed: string, rowId: string, env?: NodeJS.ProcessEnv) => {
  const key = googleKey(env);
  return key ? openWith(key, sealed, rowId) : null;
};
