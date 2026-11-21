import { CircleHelp } from "lucide-react";
import { Popover } from "~/components/ui";
import { QUICK_ENTRY_EXAMPLES } from "./quickEntryCopy";

/** The ? beside the box: what quick entry does and the line formats it reads. */
export function QuickEntryHelp() {
  return (
    <Popover
      label="How quick entry works"
      dialogLabel="How quick entry works"
      placement="bottom end"
      className="btn btn-ghost btn-square btn-sm mt-1.5 shrink-0"
      trigger={<CircleHelp className="size-5" aria-hidden="true" />}
    >
      <p className="text-sm">
        Type a line and it becomes entries you confirm before anything is saved. Commas separate entries.
      </p>
      <ul className="space-y-1 text-sm" aria-label="Examples">
        {QUICK_ENTRY_EXAMPLES.map((e) => (
          <li key={e.line}>
            <span className="font-mono">{e.line}</span>
            <span className="text-base-content/70"> — {e.makes}</span>
          </li>
        ))}
      </ul>
    </Popover>
  );
}
