import { PageHeader } from "~/components/ui";

/**
 * The full timeline's "Timeline" heading, like the other sections (no
 * recipient card: the profile is in the group menu). View options sits in
 * the filter row (`FilterChips`' trailing control), and the + menu is on each
 * day's heading (`DayHeader`).
 */
export function TimelineHeader() {
  return <PageHeader title="Timeline" />;
}
