import type { Route } from "./+types/route";

import { redirect } from "react-router";
import { requireStaff } from "~/.server/admin";
import { adminStartPath } from "../adminSections";

/** /admin opens the first section the staff member may see. */
export async function loader({ request }: Route.LoaderArgs) {
  const { capabilities } = await requireStaff(request);
  const start = adminStartPath(capabilities);
  if (!start) throw new Response("Not found", { status: 404 });
  throw redirect(start);
}
