import type { Route } from "./+types/authorization-server";

import { authorizationServerMetadata } from "~/.server/connectors";

// RFC 8414's authorization-server metadata (web only), from Better Auth's
// OAuth plugin: its issuer is /api/auth, so clients look here.
export const loader = ({ request }: Route.LoaderArgs) => authorizationServerMetadata(request);
