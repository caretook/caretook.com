import type { LucideIcon } from "lucide-react";
import type { LinkOption, LinkPick, LinkType } from "~/lib/todos/linkOptions";

import { CalendarClock, NotebookPen, Pill } from "lucide-react";
import { useMemo, useState } from "react";
import { PROVIDER_TYPE_ICONS } from "~/components/providers";
import { ChipGroup, ComboBox } from "~/components/ui";
import { LINK_TYPE_CHIPS, linkTypeWord } from "~/lib/todos/linkOptions";
import { useLinkSearch } from "./useLinkSearch";

const ICONS: Record<Exclude<LinkOption["type"], "provider">, LucideIcon> = {
  medication: Pill,
  event: CalendarClock,
  note: NotebookPen,
};

const iconOf = (option: LinkOption) =>
  option.type === "provider" ? PROVIDER_TYPE_ICONS[option.providerType ?? "other"] : ICONS[option.type];

/**
 * The one "Link to…" box (todo-links): a search over what a todo can link
 * to (providers, medications, notes and events, through site search's
 * index, in its order), each choice with its type's icon and a second line.
 * What's `linked` already isn't offered. Type chips above it (All,
 * Providers, Events, Meds, Notes; one on) narrow it; a type word typed
 * first or last ("provider lee") turns its chip on while it's there, and a
 * chip tapped then takes the word out. The list opens on typing (an
 * empty box has nothing to offer yet); a pick calls `onPick` and clears the
 * text, closing it. While the index is being prepared it says so. Writers only:
 * the caller decides.
 */
export function LinkToBox({
  groupId,
  linked,
  onPick,
  label = "Link to",
}: {
  groupId: string;
  /** The ids the todo links already (left out). */
  linked: readonly string[];
  onPick: (pick: LinkPick) => void;
  label?: string;
}) {
  const [text, setText] = useState("");
  const [chosen, setChosen] = useState<LinkType | null>(null);
  const typed = linkTypeWord(text);
  const type = typed.type ?? chosen;
  const { options, status } = useLinkSearch(groupId, text, linked, chosen);
  const chips = LINK_TYPE_CHIPS.map((chip) => ({
    id: chip.type ?? "all",
    label: chip.label,
    pressed: chip.type === type,
    onPress: () => {
      setChosen(chip.type);
      if (typed.type) setText(typed.rest);
    },
  }));
  const choices = useMemo(() => options.map((o) => ({ ...o, icon: iconOf(o) })), [options]);
  const emptyText =
    status === "preparing"
      ? "Preparing search…"
      : status === "unavailable"
        ? "Search isn't available on this device"
        : "Nothing to link matches";
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
        opensOn="typing"
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
