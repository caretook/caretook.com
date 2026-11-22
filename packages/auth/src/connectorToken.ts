import type { ValidateToken } from "@caretook/data";
import type { Auth } from "./auth";

import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";
import { getAuth } from "./auth";

/**
 * Validates a connector's access token through the OAuth plugin, for
 * `connectorGrantService.verify`: whom it's for, its client and scopes, or
 * null when it's unknown, expired, revoked or for another resource.
 */
export const validateConnectorToken =
  (auth: () => Auth = getAuth): ValidateToken =>
  async (token) => {
    const res = await auth().api.verifyConnectorToken({ body: { token } });
    return res.active ? { userId: res.userId, clientId: res.clientId, scopes: res.scopes } : null;
  };

/** Whether `query` (the search /connect was sent, without "?") is one the plugin signed and is still fresh. */
export const isSignedConnectQuery = async (query: string, auth: () => Auth = getAuth) =>
  (await auth().api.checkConnectorQuery({ body: { query } })).valid;

/** RFC 8414's authorization-server metadata, for the root `/.well-known/` routes (the issuer is `/api/auth`). */
export const connectorAuthServerMetadata = (request: Request, auth: () => Auth = getAuth) =>
  oauthProviderAuthServerMetadata(auth())(request);
