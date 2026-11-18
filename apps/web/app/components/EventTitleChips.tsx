import { useEventTitleSuggestions } from "~/lib/sync/titleSuggestions";

/**
 * One-tap names for an unnamed event: the group's recent event titles.
 * Picking one names the event (saving a draft), then puts the cursor in the
 * document, since the chips go away once it's named.
 */
export function EventTitleChips({ groupId, onPick }: { groupId: string; onPick: (title: string) => void }) {
  const titles = useEventTitleSuggestions(groupId);
  if (titles.length === 0) return null;

  const pick = (title: string) => {
    onPick(title);
    document.querySelector<HTMLElement>('main [contenteditable="true"]')?.focus();
  };

  return (
    <ul aria-label="Suggested titles" className="flex flex-wrap gap-1.5 pt-1.5">
      {titles.map((title) => (
        <li key={title}>
          <button
            type="button"
            className="btn btn-sm btn-soft rounded-full font-normal"
            onClick={() => pick(title)}
          >
            {title}
          </button>
        </li>
      ))}
    </ul>
  );
}
