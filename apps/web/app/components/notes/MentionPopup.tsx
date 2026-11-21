import type { MentionPopupState } from "./useMentionPopup";

import { Plus } from "lucide-react";
import { createPortal } from "react-dom";

/** The option element's id, for the editor's `aria-activedescendant`. */
export const mentionOptionId = (popupId: string, index: number) => `${popupId}-${index}`;

/**
 * The `@` popup: the providers that match what's typed after the `@`, under
 * the caret (the suggestion plugin positions it). Arrows move, Enter picks
 * and Escape closes (handled in the editor, so focus never leaves the text);
 * a tap picks too. It names each option and what it is; writers' last row
 * adds the typed name as a provider.
 */
export function MentionPopup({ popup }: { popup: MentionPopupState }) {
  const { id, options, active, popupRef, pick, highlight } = popup;
  if (!options) return null;
  const matched = options.some((o) => o.kind === "provider");
  return createPortal(
    <div
      ref={popupRef}
      className="rounded-box border-base-300 bg-base-100 z-50 max-h-72 max-w-[min(20rem,calc(100vw-2rem))] overflow-y-auto border p-1 shadow-lg"
      data-mention-popup
    >
      {!matched && (
        <p role="status" className="text-base-content/70 px-3 py-2 text-sm">
          No providers match
        </p>
      )}
      {options.length > 0 && (
        <ul id={id} role="listbox" aria-label="Providers to mention">
          {options.map((option, i) => (
            // Keys go to the editor, which keeps focus (aria-activedescendant): an option only takes taps.
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events
            <li
              key={option.kind === "add" ? "add" : option.id}
              id={mentionOptionId(id, i)}
              role="option"
              aria-selected={i === active}
              data-mention-add={option.kind === "add" || undefined}
              className={`cursor-pointer rounded-field px-3 py-1.5 ${i === active ? "bg-base-300" : ""} ${
                option.kind === "add" && matched ? "border-base-300 mt-1 border-t" : ""
              }`}
              // Keep the caret in the text: a tap shouldn't blur the editor.
              onMouseDown={(e) => e.preventDefault()}
              // Moving the pointer highlights; a popup opening under a still pointer doesn't.
              onMouseMove={() => i !== active && highlight(i)}
              onClick={() => pick(option)}
            >
              {option.kind === "add" ? (
                <span className="flex items-center gap-2 font-medium">
                  <Plus className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{option.label}</span>
                </span>
              ) : (
                <>
                  <span className="block truncate font-medium">{option.label}</span>
                  {option.description && (
                    <span className="text-base-content/70 block truncate text-xs">{option.description}</span>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>,
    document.body,
  );
}
