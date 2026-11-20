import type { UnitChoices } from "@caretook/data/schema";

import { Field } from "~/components/ui";
import { QuickEntryCard } from "./QuickEntryCard";
import { useQuickEntry } from "./useQuickEntry";

const EXAMPLE = "bp 130/85 hr 72, gave metformin, pain 4 left knee";
/** Simple mode's hint under its large box: talking is the easy way in. */
export const DICTATION_HINT = "Tap the microphone on your keyboard to say it instead of typing.";

/** The box's look: the timeline's (`md`), or simple mode's large one (`lg`, its label and a dictation hint shown). */
export type QuickEntrySize = "md" | "lg";
const TEXTAREA_CLASS: Record<QuickEntrySize, string> = {
  md: "min-h-11 text-base",
  lg: "textarea-lg min-h-16 text-xl",
};
const BUTTON_SIZE: Record<QuickEntrySize, string> = { md: "", lg: "btn-lg" };

/**
 * One box to say what happened: type (or dictate with the keyboard's mic)
 * a line, see a card per part, fix any with its chips, Edit or Remove, then
 * Save writes them all at once, on this device (offline too). Nothing is
 * saved before Save. Writers only: the timeline leaves it out for viewers.
 */
export function QuickEntryBox({
  groupId,
  units,
  size = "md",
}: {
  groupId: string;
  units: UnitChoices;
  size?: QuickEntrySize;
}) {
  const q = useQuickEntry({ groupId, units });
  const count = q.cards.length;
  return (
    <section aria-labelledby="quick-entry-heading" className="space-y-2" data-quick-entry>
      <h2 id="quick-entry-heading" className="sr-only">
        Quick entry
      </h2>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          void q.save();
        }}
      >
        <Field
          label="What happened?"
          labelHidden={size === "md"}
          help={size === "lg" ? DICTATION_HINT : undefined}
          className={size === "lg" ? "[&>label]:text-xl [&>label]:font-semibold [&>p]:text-base" : ""}
        >
          {(control) => (
            <textarea
              {...control}
              name="quickEntry"
              rows={1}
              className={`textarea field-sizing-content max-h-48 w-full resize-none ${TEXTAREA_CLASS[size]}`}
              placeholder={EXAMPLE}
              autoComplete="off"
              enterKeyHint="done"
              value={q.text}
              onChange={(e) => q.setText(e.target.value)}
              onKeyDown={(e) => {
                // Enter saves; Shift+Enter is a new line.
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void q.save();
                }
              }}
            />
          )}
        </Field>

        {count > 0 && (
          <>
            <ul aria-label="To save" className="space-y-2" data-quick-cards>
              {q.cards.map((card) => (
                <QuickEntryCard
                  key={card.key}
                  card={card}
                  preview={q.preview(card.reading)}
                  error={q.errors.get(card.key)}
                  onChoose={(index) => q.choose(card, index)}
                  onEdit={() => void q.edit(card)}
                  onRemove={() => q.remove(card)}
                />
              ))}
            </ul>
            <div className="flex items-center gap-2">
              <button type="submit" className={`btn btn-primary ${BUTTON_SIZE[size]}`} disabled={!q.canSave}>
                {q.busy ? "Saving…" : count === 1 ? "Save" : `Save all ${count}`}
              </button>
              <button type="button" className={`btn btn-ghost ${BUTTON_SIZE[size]}`} onClick={q.clear}>
                Clear
              </button>
            </div>
          </>
        )}
      </form>
      <p role="status" className="text-base-content/80 text-sm empty:hidden" data-quick-status>
        {q.status}
      </p>
      <p aria-live="polite" className="sr-only" data-quick-announce>
        {q.announcement}
      </p>
    </section>
  );
}
