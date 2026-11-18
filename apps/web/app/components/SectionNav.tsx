// A group's sections (Timeline now; Medications, Providers and Assistant
// later), from the `GROUP_SECTIONS` registry, rendered twice by the /app frame.
//
// Both are empty for now: app-shell slice 4 fills them.

/** The header's `sections` region on wide screens: links to the group's sections. */
export function SectionNav(_props: { groupId: string; pathname: string }) {
  return null;
}

/** The phone tab bar under the outlet (hidden on the entry page). */
export function TabBar(_props: { groupId: string; pathname: string }) {
  return null;
}
