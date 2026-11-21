import { useState } from "react";
import { RemindMeSheet } from "./RemindMeSheet";

/**
 * "Remind me" from a screen's ⋯ menus (the timeline, Upcoming, the entry
 * page): `ask` opens the sheet for an entry, and `sheet` is where it renders
 * (nothing while closed).
 */
export function useRemindMe(groupId: string) {
  const [asking, setAsking] = useState<{ id: string; title: string } | null>(null);
  return {
    ask: (entry: { id: string; title: string }) => setAsking(entry),
    sheet: asking && (
      <RemindMeSheet
        key={asking.id}
        groupId={groupId}
        entryId={asking.id}
        title={asking.title}
        onClose={() => setAsking(null)}
      />
    ),
  };
}
