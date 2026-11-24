import type { ActionPreview } from "~/lib/assistant/quickEntryPreview";
import type { QuickEntryCard as Card } from "./quickEntryCards";

import { ListTodo, X } from "lucide-react";
import { Badge, Button, ChipGroup, IconButton, IconChip } from "~/components/ui";
import { KIND_META, TODO_CHIP } from "~/lib/timeline/entryDisplay";
import { SymptomGate } from "~/routes/app/groups/timeline/SymptomGate";

/**
 * One part of the line, as it will be saved: its kind, what it says and
 * when, its warnings (red ones stop Save), the other ways to read it as
 * buttons ("Make it a note"), Edit (the usual sheet, filled in) and Remove.
 * The reading itself is the primary button: it saves as Enter does (every
 * card, "Save all" with several); the chips only switch the reading.
 */
export function QuickEntryCard({
  card,
  preview,
  draftLine,
  error,
  onChoose,
  onSymptomChoice,
  onEdit,
  onRemove,
  onSave,
  canSave,
  count,
}: {
  card: Card;
  preview: ActionPreview;
  /** A card that opens as the draft says so: "Opens to finish · Dr. Elena Alvarez · Wed, Nov 25". */
  draftLine?: string | null;
  error?: string;
  onChoose: (index: number) => void;
  /** A symptom card's answer (`card.symptomGate`): the catalog's name, or null for "Add new". */
  onSymptomChoice?: (use: string | null) => void;
  onEdit: () => void;
  onRemove: () => void;
  /** What Enter does: saves every card. */
  onSave: () => void;
  /** False while any card blocks or a save is busy. */
  canSave: boolean;
  /** How many cards the line has: with several, the button is "Save all". */
  count: number;
}) {
  const { kind, label } = card.reading;
  // A todo isn't a timeline entry, so it has no KIND_META: the Todos section's icon.
  const { Icon, accent, look } = kind === "todo" ? { Icon: ListTodo, ...TODO_CHIP } : KIND_META[kind];
  const blocked = card.blocking.length > 0 || !!error;
  const headingId = `quick-card-${card.key.replace(/[^\w-]/g, "_")}`;
  const adds = `${label}: ${preview.title}`;
  const saveName = count === 1 ? `Add ${adds}` : `Add all ${count}, with ${adds}`;
  return (
    <li
      className={`rounded-box bg-base-100 border p-3 ${blocked ? "border-error" : "border-base-300"}`}
      data-quick-card={kind}
      aria-labelledby={headingId}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="rounded-field hover:bg-primary/10 active:bg-primary/15 -m-1 flex min-w-0 flex-1 cursor-pointer items-start gap-2 p-1 text-start disabled:cursor-default disabled:hover:bg-transparent"
          onClick={onSave}
          disabled={!canSave}
          aria-label={saveName}
          data-quick-save-card=""
        >
          <IconChip icon={Icon} accent={accent} look={look} shape="rounded" />
          <span className="block min-w-0 flex-1">
            <span id={headingId} className="block text-sm">
              <Badge data-quick-kind="">{label}</Badge>
              <span className="text-muted"> · {preview.when}</span>
            </span>
            <span className="block font-medium break-words" data-quick-title>
              {preview.title}
            </span>
            {preview.detail && (
              <span className="text-muted block text-sm break-words" data-quick-detail>
                {preview.detail}
              </span>
            )}
            {draftLine && (
              <span className="text-muted block text-sm break-words" data-quick-opens-draft>
                {draftLine}
              </span>
            )}
          </span>
        </button>
        <IconButton label={`Remove "${card.text}"`} icon={X} onPress={onRemove} />
      </div>

      {(card.blocking.length > 0 || error) && (
        <ul className="text-error-ink mt-2 space-y-0.5 text-sm" data-quick-blocking>
          {[...card.blocking, ...(error ? [error] : [])].map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
      {card.symptomGate && onSymptomChoice && (
        <div className="mt-2">
          <SymptomGate
            gate={card.symptomGate}
            onUse={(name) => onSymptomChoice(name)}
            onAddNew={() => onSymptomChoice(null)}
            takeFocus={false}
          />
        </div>
      )}
      {card.notices.length > 0 && (
        <ul className="border-warning mt-2 space-y-0.5 border-s-4 ps-2 text-sm" data-quick-notice>
          {card.notices.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {(card.kindChoices.length > 0 || card.alternatives.length > 0) && (
          <ChipGroup
            label={`Other ways to save "${card.text}"`}
            actions={[...card.kindChoices, ...card.alternatives].map((a) => ({
              id: String(a.index),
              label: a.label,
              onPress: () => onChoose(a.index),
            }))}
          />
        )}
        <Button
          variant="ghost"
          size="sm"
          className="ms-auto"
          onClick={onEdit}
          aria-label={`Edit "${card.text}"`}
        >
          Edit
        </Button>
      </div>
    </li>
  );
}
