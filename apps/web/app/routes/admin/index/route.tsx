import type { Route } from "./+types/route";

import { redirect } from "react-router";
import { requireStaff } from "~/.server/admin";
import { adminUrls } from "../adminUrls";

export async function loader({ request }: Route.LoaderArgs) {
  await requireStaff(request);
  throw redirect(adminUrls.accessCodes());
}
