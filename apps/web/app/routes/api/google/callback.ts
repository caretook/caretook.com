import type { Route } from "./+types/callback";

import { getAuthUser, handleGoogleCallback } from "~/.server/api";

// Where Google sends the member back after Connect (web only; appointments-2):
// finishes connecting, then back to the group's Calendar & reminders page.
export const loader = ({ request }: Route.LoaderArgs) =>
  handleGoogleCallback(request, { getAuthUser: (headers) => getAuthUser(headers) });
