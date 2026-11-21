import type { ActionPreview } from "~/lib/assistant/quickEntryPreview";
import type { QuickEntryCard as Card } from "./quickEntryCards";

import { ListTodo, X } from "lucide-react";
import { ChipGroup, IconButton } from "~/components/ui";
import { KIND_META } from "~/lib/timeline/entryDisplay";

/**
 * One part of the line, as it will be saved: its kind, what it says and
 * when, its warnings (red ones stop Save), the other ways to read it as
 * chips, Edit (the usual sheet, filled in) and Remove.
 */
export function QuickEntryCard({
  card,
  preview,
  draftLine,
  error,
  onChoose,
  onEdit,
  onRemove,
}: {
  card: Card;
  preview: ActionPreview;
  /** A card that opens as the draft says so: "Opens to finish · Dr. Elena Alvarez · Wed, Nov 25". */
  draftLine?: string | null;
  error?: string;
  onChoose: (index: number) => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { kind, label } = card.reading;
  // A todo isn't a timeline entry, so it has no KIND_META: the Todos section's icon.
  const { Icon, iconClass } =
    kind === "todo" ? { Icon: ListTodo, iconClass: "bg-accent text-accent-content" } : KIND_META[kind];
  const blocked = card.blocking.length > 0 || !!error;
  const headingId = `quick-card-${card.key.replace(/[^\w-]/g, "_")}`;
  return (
    <li
      className={`rounded-box bg-base-100 border p-3 ${blocked ? "border-error" : "border-base-300"}`}
      data-quick-card={kind}
      aria-labelledby={headingId}
    >
      <div className="flex items-start gap-2">
        <span
          className={`rounded-field grid size-8 shrink-0 place-items-center ${iconClass}`}
          aria-hidden="true"
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p id={headingId} className="text-sm">
            <span className="font-semibold">{label}</span>
            <span className="text-base-content/70"> · {preview.when}</span>
          </p>
          <p className="font-medium break-words" data-quick-title>
            {preview.title}
          </p>
          {preview.detail && (
            <p className="text-base-content/80 text-sm break-words" data-quick-detail>
              {preview.detail}
            </p>
          )}
          {draftLine && (
            <p className="text-base-content/70 text-sm break-words" data-quick-opens-draft>
              {draftLine}
            </p>
          )}
        </div>
        <IconButton label={`Remove "${card.text}"`} icon={X} onPress={onRemove} />
      </div>

      {(card.blocking.length > 0 || error) && (
        <ul className="text-error mt-2 space-y-0.5 text-sm" data-quick-blocking>
          {[...card.blocking, ...(error ? [error] : [])].map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
      {card.notices.length > 0 && (
        <ul className="border-warning mt-2 space-y-0.5 border-s-4 ps-2 text-sm" data-quick-notice>
          {card.notices.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {card.alternatives.length > 0 && (
          <ChipGroup
            label={`Other ways to save "${card.text}"`}
            actions={card.alternatives.map((a) => ({
              id: String(a.index),
              label: a.label,
              onPress: () => onChoose(a.index),
            }))}
          />
        )}
        <button
          type="button"
          className="btn btn-ghost btn-sm ms-auto"
          onClick={onEdit}
          aria-label={`Edit "${card.text}"`}
        >
          Edit
        </button>
      </div>
    </li>
  );
}
