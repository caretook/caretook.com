import type { ProviderStatus, ProviderType } from "@caretook/data/schema";
import type { PickableEvent } from "../../routes/app/groups/todos/todoLinks";

import { dayLabel, foldSearchText } from "@caretook/data/schema";
import { PROVIDER_TYPE_META } from "../providers/providerDirectory";
import { upcomingTitle } from "../appointments/upcomingLabels";
import { eventWhen } from "../../routes/app/groups/todos/todoLinks";
import { linkedEntryName } from "./entryTodoDisplay";

// The "Link to…" box's options (todo-links), pure so web:unit tests them
// (relative imports): what each candidate the link search found says, its
// name and a second line, with what's already linked left out. The search
// itself is `linkSearch.sync.ts`'s.

/** What a todo links to: its provider or medication slot, or a note or event (a link row). */
export type LinkType = "provider" | "medication" | "note" | "event";

/** The box's type chips, in order: All (`null`), then one per type. */
export const LINK_TYPE_CHIPS: readonly { type: LinkType | null; label: string }[] = [
  { type: null, label: "All" },
  { type: "provider", label: "Providers" },
  { type: "event", label: "Events" },
  { type: "medication", label: "Meds" },
  { type: "note", label: "Notes" },
];

/** The words that name a type when typed first or last (folded: case and accents ignored). */
const TYPE_WORDS: Record<string, LinkType> = {
  provider: "provider",
  providers: "provider",
  doctor: "provider",
  doctors: "provider",
  dr: "provider",
  med: "medication",
  meds: "medication",
  medication: "medication",
  medications: "medication",
  event: "event",
  events: "event",
  appt: "event",
  appts: "event",
  appointment: "event",
  appointments: "event",
  note: "note",
  notes: "note",
};

const typeOfWord = (word: string | undefined): LinkType | null =>
  word === undefined ? null : (TYPE_WORDS[foldSearchText(word).replace(/\.$/, "")] ?? null);

/**
 * A type word typed with the search ("provider lee", "lee meds", "Dr. Lee"):
 * the first word, else the last, when it names a type (`TYPE_WORDS`), with
 * the rest of the text to search. A word alone names its type and leaves
 * nothing to search. No type word: `{ type: null, rest: text }`.
 */
export const linkTypeWord = (text: string): { type: LinkType | null; rest: string } => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const first = typeOfWord(words[0]);
  if (first) return { type: first, rest: words.slice(1).join(" ") };
  const last = typeOfWord(words.at(-1));
  if (last) return { type: last, rest: words.slice(0, -1).join(" ") };
  return { type: null, rest: text };
};

/** A pick in the box. */
export type LinkPick = { type: LinkType; id: string };

/** A provider as the box shows it. */
export type LinkableProvider = {
  type: ProviderType;
  name: string;
  specialty: string | null;
  status: ProviderStatus;
  /** Its practice's name, when it has a live one. */
  practiceName: string | null;
};

/** A medication as the box shows it. */
export type LinkableMedication = { name: string; strength: string | null; status: string };

/** A note as the box shows it: `text` is its document's (its first line names an untitled one). */
export type LinkableNote = { kind: string; title: string | null; occurredAt: string; text: string | null };

/** One thing the link search found, with the row it shows. */
export type LinkCandidate =
  | { type: "provider"; id: string; provider: LinkableProvider }
  | { type: "medication"; id: string; medication: LinkableMedication }
  | { type: "event"; id: string; event: PickableEvent }
  | { type: "note"; id: string; note: LinkableNote };

/** One option in the box: its name, a second line, and (a provider) its type for the icon. */
export type LinkOption = {
  id: string;
  type: LinkType;
  label: string;
  description: string;
  providerType?: ProviderType;
};

type Where = { locale?: string; timeZone?: string };

const joined = (parts: readonly (string | null | undefined | false)[]) => parts.filter(Boolean).join(" · ");

const optionOf = (candidate: LinkCandidate, now: Date, where: Where): LinkOption => {
  switch (candidate.type) {
    case "provider": {
      const p = candidate.provider;
      return {
        id: candidate.id,
        type: "provider",
        label: p.name,
        description: joined([
          p.specialty?.trim() || PROVIDER_TYPE_META[p.type].label,
          p.practiceName,
          p.status === "past" && "Past",
        ]),
        providerType: p.type,
      };
    }
    case "medication": {
      const m = candidate.medication;
      return {
        id: candidate.id,
        type: "medication",
        label: m.name,
        description: joined([m.strength?.trim(), m.status !== "current" && "Stopped"]) || "Medication",
      };
    }
    case "event":
      return {
        id: candidate.id,
        type: "event",
        label: upcomingTitle(candidate.event),
        description: eventWhen(candidate.event, now, where),
      };
    case "note": {
      const n = candidate.note;
      const zone = where.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
      return {
        id: candidate.id,
        type: "note",
        label: linkedEntryName(n, n.text),
        description: dayLabel(n.occurredAt, zone, now, where.locale),
      };
    }
  }
};

/**
 * The box's options for the link search's candidates, in their order, each
 * named and with its second line: an event's when ("Tomorrow 10:30 AM"), a
 * provider's specialty or type, its practice, and "Past"; a medication's
 * strength ("Stopped" once stopped); a note's day. The ids in `linked`
 * (what the todo links already) are left out.
 */
export const linkOptions = (
  candidates: readonly LinkCandidate[],
  now: Date,
  { linked = [], ...where }: Where & { linked?: readonly string[] } = {},
): LinkOption[] => {
  const skip = new Set(linked);
  return candidates.filter((c) => !skip.has(c.id)).map((c) => optionOf(c, now, where));
};

// --- Suggestions (B-947) -----------------------------------------------------

/** How many upcoming events the empty box suggests. */
export const SUGGESTED_UPCOMING = 3;
/** How many recently viewed records the empty box suggests. */
export const SUGGESTED_RECENT = 5;

/**
 * What the empty box suggests, in order: the record it was opened from
 * (`cameFrom`: the page the sheet came from), then the next
 * `SUGGESTED_UPCOMING` of the `upcoming` events (soonest first), then the
 * last `SUGGESTED_RECENT` of the `recent`ly viewed (newest first). Each
 * once (where it first comes), what's `linked` already left out, and only
 * the chip's `type` when one is on; the counts are of what's left.
 */
export const linkSuggestions = ({
  cameFrom = null,
  upcoming = [],
  recent = [],
  linked = [],
  type = null,
}: {
  cameFrom?: LinkPick | null;
  upcoming?: readonly LinkPick[];
  recent?: readonly LinkPick[];
  linked?: readonly string[];
  type?: LinkType | null;
}): LinkPick[] => {
  const seen = new Set(linked);
  const take = (picks: readonly LinkPick[], limit: number) => {
    const kept: LinkPick[] = [];
    for (const pick of picks) {
      if (kept.length >= limit) break;
      if (seen.has(pick.id) || (type !== null && pick.type !== type)) continue;
      seen.add(pick.id);
      kept.push({ type: pick.type, id: pick.id });
    }
    return kept;
  };
  return [
    ...take(cameFrom ? [cameFrom] : [], 1),
    ...take(upcoming, SUGGESTED_UPCOMING),
    ...take(recent, SUGGESTED_RECENT),
  ];
};
