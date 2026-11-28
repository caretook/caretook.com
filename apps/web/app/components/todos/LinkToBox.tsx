import type { LucideIcon } from "lucide-react";
import type { LinkOption, LinkPick, LinkType } from "~/lib/todos/linkOptions";

import { useMemo, useState } from "react";
import { MEDICATION_GLYPH } from "~/components/medications";
import { PROVIDER_TYPE_ICONS } from "~/components/providers";
import { ChipGroup, ComboBox } from "~/components/ui";
import { KIND_META } from "~/lib/timeline/entryDisplay";
import { LINK_TYPE_CHIPS, linkTypeWord } from "~/lib/todos/linkOptions";
import { useLinkSearch } from "./useLinkSearch";

/** Each type's icon, the same as its display's: the timeline's kinds, the medication's pill. */
const ICONS: Record<Exclude<LinkOption["type"], "provider">, LucideIcon> = {
  medication: MEDICATION_GLYPH,
  event: KIND_META.event.Icon,
  note: KIND_META.note.Icon,
};

const iconOf = (option: LinkOption) =>
  option.type === "provider" ? PROVIDER_TYPE_ICONS[option.providerType ?? "other"] : ICONS[option.type];

/**
 * The one "Link to…" box (todo-links): a search over what a todo can link
 * to (providers, medications, notes and events, through site search's
 * index, in its order), each choice with its type's icon and a second line.
 * What's `linked` already isn't offered. Type chips above it (All,
 * Providers, Events, Meds, Notes; one on) narrow it; a type word typed
 * first or last ("provider lee") turns its chip on while it narrows the
 * list (not when the whole text was searched instead: "eye doctor"), and a
 * chip tapped then takes the word out. The list opens on focus: with no
 * text (or a type word alone) it suggests (B-947) the record it was opened
 * from (`cameFrom`), the next events and what this user viewed recently,
 * narrowed by the chip; typing replaces them with results. A pick calls
 * `onPick`, clears the text and closes the list. While the index is being
 * prepared it says so, and still suggests. Writers only: the caller decides.
 */
export function LinkToBox({
  groupId,
  linked,
  onPick,
  cameFrom = null,
  label = "Link to",
}: {
  groupId: string;
  /** The ids the todo links already (left out). */
  linked: readonly string[];
  onPick: (pick: LinkPick) => void;
  /** The record the sheet was opened from (its page), suggested first. */
  cameFrom?: LinkPick | null;
  label?: string;
}) {
  const [text, setText] = useState("");
  const [chosen, setChosen] = useState<LinkType | null>(null);
  const typed = linkTypeWord(text);
  const { options, status, wordType, forText } = useLinkSearch(groupId, text, {
    linked,
    type: chosen,
    cameFrom,
  });
  // The typed type word, unless the list for this text was searched without it.
  const word = forText === text ? wordType : typed.type;
  const type = word ?? chosen;
  const chips = LINK_TYPE_CHIPS.map((chip) => ({
    id: chip.type ?? "all",
    label: chip.label,
    pressed: chip.type === type,
    onPress: () => {
      setChosen(chip.type);
      if (word) setText(typed.rest);
    },
  }));
  const choices = useMemo(() => options.map((o) => ({ ...o, icon: iconOf(o) })), [options]);
  const emptyText =
    status === "preparing"
      ? "Preparing search…"
      : status === "unavailable"
        ? "Search isn't available on this device"
        : typed.rest.trim()
          ? "Nothing to link matches"
          : "Type to find a provider, medication, note or event";
  return (
    <div className="flex flex-col gap-1" data-link-to-box="">
      <ChipGroup label="Link type" actions={chips} />
      <ComboBox
        label={label}
        placeholder="Link to a provider, medication, note or event"
        options={choices}
        inputValue={text}
        onInputChange={setText}
        onSelect={(id) => {
          const option = options.find((o) => o.id === id);
          if (!option) return;
          setText("");
          onPick({ type: option.type, id });
        }}
        emptyText={emptyText}
        reopenOn={chosen}
      />
      {status === "preparing" && (
        <p className="text-muted text-sm" data-link-to-status="">
          Preparing search…
        </p>
      )}
    </div>
  );
}
