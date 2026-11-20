import { ChipGroup } from "~/components/ui";
import { useEventTitleSuggestions } from "~/lib/live-notes/titleSuggestions.sync";

/**
 * One-tap names for an unnamed event: the group's recent event titles.
 * Picking one names the event (saving a draft); the page then puts the
 * cursor in the document, since the chips go away once it's named.
 */
export function EventTitleChips({ groupId, onPick }: { groupId: string; onPick: (title: string) => void }) {
  const titles = useEventTitleSuggestions(groupId);
  if (titles.length === 0) return null;

  return (
    <ChipGroup
      label="Suggested titles"
      className="pt-1.5"
      actions={titles.map((title) => ({ id: title, label: title, onPress: () => onPick(title) }))}
    />
  );
}
