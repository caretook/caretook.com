/**
 * Better Auth endpoints that always read the live session, never the
 * session cookie cache (B-140): PowerSync's token (`/token`, the jwt
 * plugin). Matched exactly: `/oauth2/token` and the oauth-provider's other
 * paths are theirs, not this rule's.
 */
const LIVE_SESSION_PATHS: ReadonlySet<string> = new Set(["/token"]);

export const readsLiveSession = (path: string) => LIVE_SESSION_PATHS.has(path);
