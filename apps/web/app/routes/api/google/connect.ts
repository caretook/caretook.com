import type { Route } from "./+types/connect";

import { getAuthUser, handleGoogleConnect } from "~/.server/api";

// Connect Google Calendar (web only; appointments-2): the Google card's
// Connect link. Sends a member of the group on to Google's consent page.
export const loader = ({ request }: Route.LoaderArgs) =>
  handleGoogleConnect(request, { getAuthUser: (headers) => getAuthUser(headers) });
