import type { TimelineEntryKind, VitalType } from "@caretook/data/schema";

import { ChevronDown } from "lucide-react";
import { KIND_META } from "~/lib/entryDisplay";
import { VitalTypeMenu } from "./VitalTypeMenu";

const DIRECT_KINDS = ["note", "symptom", "event"] as const satisfies TimelineEntryKind[];

const TILE = "btn btn-ghost h-auto min-h-12 flex-col gap-0.5 px-1 py-1.5 text-xs font-medium";

/**
 * One tap to start an entry of a given kind: Note, Symptom, Event, or a vital
 * type from the Vitals menu. Four equal tiles, so it stays one row on phones.
 * The form itself opens in a sheet.
 */
export function QuickAddBar({ onAdd }: { onAdd: (kind: TimelineEntryKind, vitalType?: VitalType) => void }) {
  return (
    <div
      role="group"
      aria-label="Add to the timeline"
      className="rounded-box border-base-300 bg-base-100 grid grid-cols-4 gap-1 border p-1"
    >
      {DIRECT_KINDS.map((kind) => {
        const { Icon, label } = KIND_META[kind];
        return (
          <button key={kind} type="button" className={TILE} onClick={() => onAdd(kind)}>
            <Icon className="size-5" aria-hidden="true" />
            {label}
          </button>
        );
      })}
      <VitalTypeMenu className={TILE} onSelect={(type) => onAdd("vital", type)}>
        <KIND_META.vital.Icon className="size-5" aria-hidden="true" />
        <span className="inline-flex items-center gap-0.5">
          Vitals
          <ChevronDown className="size-3" aria-hidden="true" />
        </span>
      </VitalTypeMenu>
    </div>
  );
}
