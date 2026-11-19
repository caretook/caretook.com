import type { Route } from "./+types/route";

import { requireStaff } from "~/.server/admin";
import { waitlistCsv, waitlistCsvFileName } from "../waitlist/waitlistCsv";
import { parseWaitlistSearch } from "../waitlist/waitlistFilters";

// /admin/waitlist/export: the waitlist's matching entries as a CSV download
// (staff only, like every /admin page; anyone else gets the 404). Takes the
// list's own query string, so it holds exactly the rows the list counted.

export async function loader({ request }: Route.LoaderArgs) {
  const { api } = await requireStaff(request);
  const { filter } = parseWaitlistSearch(new URL(request.url).search);
  const entries = await api.admin.waitlist.export(filter);
  return new Response(waitlistCsv(entries), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${waitlistCsvFileName(new Date())}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
