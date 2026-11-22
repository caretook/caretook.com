import type { DialogChoice } from "~/components/ui";

import { ChoiceDialog } from "~/components/ui";

type Choice = "skip" | "stop";

const CHOICES: DialogChoice<Choice>[] = [
  { id: "skip", label: "Skip this one", tone: "primary", "data-repeat-skip": true },
  { id: "stop", label: "Delete and stop repeating", tone: "dangerQuiet", "data-repeat-stop": true },
];

/**
 * Delete on a repeating todo (planner-2): a `ChoiceDialog` with "Skip this
 * one" (this one goes, the next one comes), "Delete and stop repeating" (it
 * goes with no next), and Cancel (as Escape). It opens once the ⋯ menu that
 * asked has closed.
 */
export function RepeatDeleteDialog({
  open,
  title,
  onSkip,
  onStop,
  onClose,
}: {
  open: boolean;
  title: string;
  onSkip: () => void;
  onStop: () => void;
  onClose: () => void;
}) {
  return (
    <ChoiceDialog
      open={open}
      title="Delete this repeating todo?"
      message={`Skip this one and the next “${title}” comes on its day, or delete it and stop repeating. Its notes are removed for everyone in the care group.`}
      choices={CHOICES}
      cancelLabel="Cancel"
      onChoose={(id) => (id === "skip" ? onSkip() : onStop())}
      onClose={onClose}
      data-repeat-delete
    />
  );
}
