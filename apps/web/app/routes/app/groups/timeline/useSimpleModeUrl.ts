import type { TimelineFilters } from "~/lib/timeline/timelineFilters";

import { useEffect } from "react";
import { useNavigate } from "react-router";
import { appUrls } from "~/lib/app-shell/appUrls";
import { hasFilters } from "~/lib/timeline/timelineFilters";

/**
 * Simple mode has no filters, search or Upcoming block: a timeline URL that
 * carries any (an old link, or switching from the full timeline) is replaced
 * by the plain one, so the list never hides entries with nothing to say so.
 */
export function useSimpleModeUrl(groupId: string, simple: boolean, filters: TimelineFilters) {
  const navigate = useNavigate();
  const filtered = hasFilters(filters) || filters.upcoming || !!filters.vital;
  useEffect(() => {
    if (simple && filtered) void navigate(appUrls.timeline(groupId), { replace: true });
  }, [simple, filtered, groupId, navigate]);
}
