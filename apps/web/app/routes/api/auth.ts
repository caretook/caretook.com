import type { Route } from "./+types/auth";

import { getAuth } from "~/.server/auth";

// Better Auth's endpoints (/api/auth/*). Web only: the native app calls the
// deployed web server's copy.
export const loader = ({ request }: Route.LoaderArgs) => getAuth().handler(request);
export const action = ({ request }: Route.ActionArgs) => getAuth().handler(request);
