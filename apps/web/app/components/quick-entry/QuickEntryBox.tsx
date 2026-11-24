import type { UnitChoices } from "@caretook/data/schema";
import type { RefObject } from "react";

import { useId, useRef } from "react";
import { PassUndoStatus } from "~/components/medications";
import { Button, Field, Message } from "~/components/ui";
import { QuickEntryCard } from "./QuickEntryCard";
import { QuickEntryGoToCard } from "./QuickEntryGoToCard";
import { QuickEntryCompletions, useCompletionsOverlay } from "./QuickEntryCompletions";
import { QuickEntrySuggestButton, SUGGEST_ROOM } from "./QuickEntrySuggestButton";
import { QUICK_ENTRY_UNDO, useQuickEntry } from "./useQuickEntry";
import { useQuickEntrySuggestions } from "./useQuickEntrySuggestions";
import { QUICK_ENTRY_PLACEHOLDER, QUICK_ENTRY_RULES } from "./quickEntryCopy";

/** Easy mode's hint under its large box: talking is the easy way in. */
export const DICTATION_HINT = "Tap the microphone on your keyboard to say it instead of typing.";

/** The box's look: the timeline's (`md`), or easy mode's large one (`lg`, its label and a dictation hint shown). */
export type QuickEntrySize = "md" | "lg";
const TEXTAREA_CLASS: Record<QuickEntrySize, string> = {
  md: "min-h-11 text-base",
  lg: "textarea-lg min-h-16 text-xl",
};

/**
 * One box to say what happened: type (or dictate with the keyboard's mic)
 * a line, see a card per part, fix any with its chips, Edit or Remove, then
 * Save writes them all at once, on this device (offline too), and offers
 * Undo for the whole line for about 10 s. An empty box offers suggestions
 * behind the Sparkles button inside it; while typing, matching names float
 * under the field. Nothing is saved before Save, except a due pass's chip,
 * which is Given all in one tap (with the same Undo). Writers only: the
 * timeline leaves it out for viewers.
 */
export function QuickEntryBox({
  groupId,
  units,
  size = "md",
  passChips = size === "md",
  fieldRef,
}: {
  groupId: string;
  units: UnitChoices;
  size?: QuickEntrySize;
  /** Offer the due passes as one-tap chips ("Give evening meds"). Easy mode turns them off: its Upcoming block has Given all. */
  passChips?: boolean;
  /** The field itself, for a caller that brings it into view and focuses it (the empty Today's "Add an entry"). */
  fieldRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const q = useQuickEntry({ groupId, units });
  const count = q.cards.length;
  const ownField = useRef<HTMLTextAreaElement>(null);
  const field = fieldRef ?? ownField;
  const rulesId = useId();
  const { usual, recent, completions } = useQuickEntrySuggestions({
    groupId,
    text: q.text,
    passes: q.passes,
  });
  const names = useCompletionsOverlay(q.text, field);
  const empty = !q.text.trim();
  const due = passChips ? q.dueNow : [];
  const suggest = empty && (due.length > 0 || usual.length > 0 || recent.length > 0);
  /** A suggestion fills the box and waits there, the cursor at the end (it never saves). */
  const fill = (value: string) => {
    q.setText(value);
    requestAnimationFrame(() => {
      const el = field.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(value.length, value.length);
    });
  };
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
          kind="textarea"
          labelHidden={size === "md"}
          help={size === "lg" ? DICTATION_HINT : undefined}
          className={size === "lg" ? "[&>label]:text-xl [&>label]:font-semibold [&>p]:text-base" : ""}
        >
          {(control) => (
            <div className="relative" {...names.area}>
              <textarea
                {...control}
                aria-describedby={[control["aria-describedby"], rulesId].filter(Boolean).join(" ")}
                ref={field}
                name="quickEntry"
                rows={1}
                className={`${control.className ?? ""} field-sizing-content max-h-48 resize-none ${TEXTAREA_CLASS[size]} ${suggest ? SUGGEST_ROOM[size] : ""}`}
                placeholder={QUICK_ENTRY_PLACEHOLDER}
                autoComplete="off"
                enterKeyHint="done"
                value={q.text}
                onChange={(e) => q.setText(e.target.value)}
                onKeyDown={(e) => {
                  names.onKeyDown(e);
                  // Enter saves; Shift+Enter is a new line.
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void q.save();
                  }
                }}
              />
              {suggest && (
                <QuickEntrySuggestButton
                  size={size}
                  usual={usual}
                  recent={recent}
                  duePasses={due}
                  onFill={fill}
                  onGivePass={passChips ? q.givePass : undefined}
                  passBusy={q.passBusy}
                />
              )}
              {!empty && completions.length > 0 && names.open && (
                <QuickEntryCompletions completions={completions} onFill={fill} onKeyDown={names.onKeyDown} />
              )}
            </div>
          )}
        </Field>
        <p id={rulesId} className="sr-only">
          {QUICK_ENTRY_RULES}
        </p>
        {q.goTo && <QuickEntryGoToCard goTo={q.goTo} />}
        {count > 0 && (
          <ul aria-label="To save" className="space-y-2" data-quick-cards>
            {q.cards.map((card) => (
              <QuickEntryCard
                key={card.key}
                card={card}
                preview={q.preview(card.reading)}
                draftLine={q.draftLine(card)}
                error={q.errors.get(card.key)}
                onChoose={(index) => q.choose(card, index)}
                onEdit={() => void q.edit(card)}
                onRemove={() => q.remove(card)}
              />
            ))}
          </ul>
        )}
        {!empty && (
          <div className="flex items-center gap-2">
            {q.goTo && (
              <Button type="submit" variant="primary" size={size} disabled={q.goTo.ahead}>
                Go
              </Button>
            )}
            {count > 0 && (
              <Button type="submit" variant="primary" size={size} disabled={!q.canSave}>
                {q.busy ? "Saving…" : count === 1 ? "Save" : `Save all ${count}`}
              </Button>
            )}
            <Button variant="ghost" size={size} onClick={q.clear}>
              Clear
            </Button>
          </div>
        )}
      </form>
      <PassUndoStatus groupId={groupId} place={QUICK_ENTRY_UNDO} className="empty:hidden" />
      <Message data-quick-status="">{q.status || q.passError}</Message>
      <p aria-live="polite" className="sr-only" data-quick-announce>
        {q.announcement}
      </p>
    </section>
  );
}
