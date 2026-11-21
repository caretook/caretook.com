import type { ProviderStatus, ProviderType } from "@caretook/data/schema";
import type { TimedEntry } from "../../../../lib/appointments/upcoming";

import { dayLabel } from "../../../../lib/core/format";
import { medicationTitle } from "../../../../lib/medications/medicationDisplay";
import {
  compareProviders,
  fold,
  matchesQuery,
  PROVIDER_TYPE_META,
  queryTokens,
} from "../../../../lib/providers/providerDirectory";
import { entryTiming, upcomingOrder } from "../../../../lib/appointments/upcoming";
import { timeRange, upcomingTitle } from "../../../../lib/appointments/upcomingLabels";

// The todo form's three link pickers, their pure parts (web:unit tests it,
// so imports stay relative): which providers, appointments and medications
// each offers for the typed text, in what order, and what a chosen one's
// chip says. Like the medication form's `medicationProviders`.

/** How many choices a picker lists at most. */
export const LINK_PICKER_LIMIT = 20;

/** How far back the appointment picker reaches: the last 30 days' events. */
export const RECENT_EVENT_DAYS = 30;

const DAY_MS = 86_400_000;

export type LinkOption = { id: string; label: string; description?: string };

type Where = { locale?: string; timeZone?: string };

// --- Providers ---------------------------------------------------------------

export type PickableProvider = {
  id: string;
  type: ProviderType;
  name: string;
  specialty: string | null;
  practiceId: string | null;
  status: ProviderStatus;
  isPrimary: boolean;
  deletedAt: string | null;
};

/**
 * The provider picker's choices: the group's live providers of every type
 * matching every typed word (name, specialty or practice), in display order,
 * each saying what it is ("Cardiology · Westside Family Medicine", "Pharmacy").
 */
export const providerLinkOptions = (
  providers: readonly PickableProvider[],
  text: string,
  limit = LINK_PICKER_LIMIT,
): LinkOption[] => {
  const names = new Map(providers.map((p) => [p.id, p.name]));
  const tokens = queryTokens(text);
  return providers
    .filter((p) => !p.deletedAt)
    .filter((p) => matchesQuery(p, tokens, p.practiceId ? names.get(p.practiceId) : null))
    .sort(compareProviders)
    .slice(0, limit)
    .map((p) => {
      const practice = p.practiceId ? names.get(p.practiceId) : null;
      const what = p.specialty || PROVIDER_TYPE_META[p.type].label;
      const parts = [what, practice, p.status === "past" ? "Past" : null].filter(Boolean);
      return { id: p.id, label: p.name, description: parts.join(" · ") };
    });
};

// --- Appointments ------------------------------------------------------------

export type PickableEvent = TimedEntry & {
  kind: string;
  title: string | null;
  deletedAt: string | null;
};

/** When an event is, in a line: "Tomorrow 10:30 AM–11:15 AM", "Friday, Nov 21 · All day". */
export const eventWhen = (event: PickableEvent, now: Date, where: Where = {}) => {
  const zone = where.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  // An all-day event's day is its own zone's.
  const day = dayLabel(event.occurredAt, event.allDay ? event.timeZone : zone, now, where.locale);
  return event.allDay ? `${day} · All day` : `${day} ${timeRange(event, where)}`;
};

/**
 * The appointment picker's choices: live, not cancelled events that are
 * upcoming (or in progress) or started in the last 30 days, matching every
 * typed word of the title. Upcoming ones first, soonest first; then the
 * recent ones, latest first, so the nearest visits lead either way.
 */
export const eventLinkOptions = (
  events: readonly PickableEvent[],
  text: string,
  now: Date,
  where: Where = {},
  limit = LINK_PICKER_LIMIT,
): LinkOption[] => {
  const tokens = queryTokens(text);
  const since = now.getTime() - RECENT_EVENT_DAYS * DAY_MS;
  const live = events.filter(
    (e) =>
      e.kind === "event" &&
      !e.deletedAt &&
      !e.cancelledAt &&
      tokens.every((t) => fold(upcomingTitle(e)).includes(t)),
  );
  const ahead = live.filter((e) => entryTiming(e, now) !== "past").sort(upcomingOrder);
  const recent = live
    .filter((e) => entryTiming(e, now) === "past" && new Date(e.occurredAt).getTime() >= since)
    .sort((a, b) => -upcomingOrder(a, b));
  return [...ahead, ...recent].slice(0, limit).map((e) => ({
    id: e.id,
    label: upcomingTitle(e),
    description: eventWhen(e, now, where),
  }));
};

// --- Medications -------------------------------------------------------------

export type PickableMedication = {
  id: string;
  name: string;
  strength: string | null;
  status: string;
  deletedAt: string | null;
};

/** The medication picker's choices: live, current medications matching every typed word of the name, by name. */
export const medicationLinkOptions = (
  medications: readonly PickableMedication[],
  text: string,
  limit = LINK_PICKER_LIMIT,
): LinkOption[] => {
  const tokens = queryTokens(text);
  return medications
    .filter((m) => !m.deletedAt && m.status === "current")
    .filter((m) => tokens.every((t) => fold(medicationTitle(m)).includes(t)))
    .sort(
      (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || (a.id < b.id ? -1 : 1),
    )
    .slice(0, limit)
    .map((m) => ({ id: m.id, label: medicationTitle(m) }));
};

// --- Chips -------------------------------------------------------------------

/** A chosen link's chip: its name, greyed "(removed)" once deleted; "Cancelled" kept on an appointment. */
export const chosenLinkChip = (
  chosen: { label: string; deleted?: boolean; cancelled?: boolean } | null,
  fallback: string,
): { label: string; muted: boolean } => {
  if (!chosen) return { label: fallback, muted: true };
  if (chosen.deleted) return { label: `${chosen.label} (removed)`, muted: true };
  if (chosen.cancelled) return { label: `${chosen.label} (cancelled)`, muted: true };
  return { label: chosen.label, muted: false };
};
