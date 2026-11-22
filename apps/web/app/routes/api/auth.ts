import type { Route } from "./+types/auth";

import { getAuth, withConnectorAuthorizePage } from "~/.server/auth";

// Better Auth's endpoints (/api/auth/*). Web only: the native app calls the
// deployed web server's copy. A browser sent to a connector's authorize link
// that can't be used gets a page, not the plugin's error (B-188).
const handle = (request: Request) => withConnectorAuthorizePage((r) => getAuth().handler(r))(request);

export const loader = ({ request }: Route.LoaderArgs) => handle(request);
export const action = ({ request }: Route.ActionArgs) => handle(request);
