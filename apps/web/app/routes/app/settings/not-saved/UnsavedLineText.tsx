import type { UnsavedLine } from "~/lib/app-shell/unsavedChanges";

import { unsavedSentence } from "~/lib/app-shell/unsavedChanges";

/** A line's sentence, and how many changes it stands for when more than one. */
export function UnsavedLineText({ line }: { line: UnsavedLine }) {
  return (
    <p className="text-sm" data-not-saved-text="">
      {unsavedSentence(line)}
      {line.count > 1 && <span className="text-muted"> · {line.count} changes</span>}
    </p>
  );
}
