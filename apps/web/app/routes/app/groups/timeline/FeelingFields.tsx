import type { SymptomDetails } from "@caretook/data/schema";
import type { LucideIcon } from "lucide-react";

import { Angry, Annoyed, Frown, Laugh, Meh, Smile } from "lucide-react";
import { useId } from "react";
import { TIMELINE_LIMITS } from "@caretook/data/schema";
import { Field } from "~/components/ui";
import { FEELING_SYMPTOM_NAME } from "~/lib/simpleTiles";

/** The scale's words at each end and the middle, read with the number. */
export const feelingWords = (n: number) =>
  n === 0
    ? "feels fine"
    : n <= 3
      ? "a little unwell"
      : n <= 6
        ? "unwell"
        : n <= 9
          ? "very unwell"
          : "feels awful";

const FACES: LucideIcon[] = [Laugh, Smile, Smile, Smile, Meh, Meh, Meh, Frown, Frown, Annoyed, Angry];

/**
 * Simple mode's symptom (the "How she feels" tile): a 0–10 face scale, big
 * enough to tap without glasses, and what's wrong if they want to say. The
 * symptom is named "Feeling" when nothing is typed. A one-off scale of
 * eleven, so native radios here rather than a `ChoiceGroup` (a few joined
 * buttons): arrow keys move along it, and each says its number and words.
 */
export function FeelingFields({
  label,
  stored,
  nameError,
  severityError,
}: {
  /** The question, about the recipient ("How she feels"). */
  label: string;
  stored?: Pick<SymptomDetails, "name" | "severity">;
  nameError?: string;
  severityError?: string;
}) {
  const id = useId();
  const max = TIMELINE_LIMITS.severityMax;
  return (
    <div className="space-y-3">
      <div className="fieldset">
        {/* The sheet's title asks the same, so it's said, not shown twice. */}
        <span id={`${id}-label`} className="sr-only">
          {label}
        </span>
        <p id={`${id}-help`} className="text-lg">
          0 is fine, {max} is the worst.
        </p>
        <div
          role="radiogroup"
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-help`}
          className="grid grid-cols-6 gap-2 sm:grid-cols-11"
          data-feeling-scale=""
        >
          {Array.from({ length: max + 1 }, (_, n) => {
            const Face = FACES[n] ?? Meh;
            return (
              <label
                key={n}
                className="btn btn-outline has-checked:btn-primary has-focus-visible:outline-2 has-focus-visible:outline-offset-2 h-auto min-h-16 flex-col gap-1 px-1 py-2 text-lg"
              >
                <input
                  type="radio"
                  name="severity"
                  value={n}
                  defaultChecked={stored?.severity === n}
                  aria-label={`${n}, ${feelingWords(n)}`}
                  className="sr-only"
                />
                <Face aria-hidden="true" className="size-7" />
                <span aria-hidden="true">{n}</span>
              </label>
            );
          })}
        </div>
        {severityError && <p className="text-error text-sm">{severityError}</p>}
      </div>
      <Field label="What's wrong? (optional)" error={nameError}>
        {(control) => (
          <input
            {...control}
            name="symptomName"
            className="input input-lg w-full"
            maxLength={TIMELINE_LIMITS.symptomName}
            defaultValue={stored?.name && stored.name !== FEELING_SYMPTOM_NAME ? stored.name : ""}
            placeholder="e.g. Sore knee"
          />
        )}
      </Field>
      <input type="hidden" name="symptomNameDefault" value={FEELING_SYMPTOM_NAME} />
    </div>
  );
}
