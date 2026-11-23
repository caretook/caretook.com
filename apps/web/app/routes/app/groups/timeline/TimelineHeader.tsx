import type { EasyModeState } from "~/lib/assistant/useEasyMode";

import { PageHeader } from "~/components/ui";
import { EasyModeToggle } from "./EasyModeToggle";

/**
 * The full timeline's "Timeline" heading, like the other sections (no
 * recipient card: the profile is in the group menu), with the "Easy mode"
 * button on its right at every width (`EasyModeToggle`; nothing when the
 * member can't toggle). View options sits in the filter row (`FilterChips`'
 * trailing control), and the + menu is on each day's heading (`DayHeader`).
 * Centered, not `PageHeader`'s top alignment: the button's 44 px target is
 * taller than the title and would hang below it.
 */
export function TimelineHeader({ easyMode }: { easyMode: EasyModeState }) {
  return (
    <PageHeader className="items-center!" title="Timeline" actions={<EasyModeToggle mode={easyMode} />} />
  );
}
