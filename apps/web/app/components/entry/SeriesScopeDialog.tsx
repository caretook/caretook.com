import type { SeriesScope } from "@caretook/data/series";
import type { DialogChoice } from "~/components/ui";
import type { SeriesAction } from "~/lib/appointments/seriesScope";

import { ChoiceDialog } from "~/components/ui";
import { scopeQuestion } from "~/lib/appointments/seriesScope";

/**
 * The question before a change to a series visit (appointments-2): a
 * `ChoiceDialog` with Only this visit, This and later visits, and Cancel
 * (as Escape), in the danger tones for a delete or a cancel. It opens once
 * the ⋯ menu that asked has closed.
 */
export function SeriesScopeDialog({
  open,
  action,
  onChoose,
  onClose,
}: {
  open: boolean;
  action: SeriesAction;
  onChoose: (scope: SeriesScope) => void;
  onClose: () => void;
}) {
  const { title, message } = scopeQuestion(action);
  const danger = action === "delete" || action === "cancel";
  const choices: DialogChoice<SeriesScope>[] = [
    { id: "only", label: "Only this visit", tone: danger ? "danger" : "primary" },
    { id: "later", label: "This and later visits", tone: danger ? "dangerQuiet" : "secondary" },
  ];

  return (
    <ChoiceDialog
      open={open}
      title={title}
      message={message}
      choices={choices}
      cancelLabel="Cancel"
      onChoose={onChoose}
      onClose={onClose}
      data-series-scope={action}
    />
  );
}
