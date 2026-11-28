import type { AppointmentSeriesContentInput } from "../schema";

import { eq } from "drizzle-orm";
import { getDb } from "../client";
import {
  addDays,
  appointmentSeriesSchema,
  dayInZone,
  encodeNoteDoc,
  entryProviderId,
  noteDocFromText,
  noteDocumentSchema,
  SERIES_AHEAD_DAYS,
  seriesVisitId,
  timelineEntryProviderSchema,
  timelineEntrySchema,
  userSchema,
  zonedInstant,
} from "../schema";
import { seriesVisits } from "../../domain/appointments/seriesVisits";
import { DEV_GROUP_ID, DEV_RECIPIENT_ID } from "./careGroups";
import { SEED_GROUPS as PROVIDER_GROUPS } from "./providers";

// Fictional repeating series for Grandma Pat (Dev Family; appointments-2):
// dialysis Mon, Wed and Fri at 6:00 with no end (started a week ago, so the
// timeline has a few), twelve weekly physical therapy visits with one moved
// on its own.
// Placed by days from today in Los Angeles, with visits through today + 90,
// as a device that made them would write them.
//
// Their own ids (…3f1d2bb3…), following list order: append only. Visit ids
// are `seriesVisitId(series, day)`, as everywhere.

const TIME_ZONE = "America/Los_Angeles";
const AUTHOR = "member@example.com";

export type SeedSeries = {
  key: string;
  /** The first day, in days from today (negative: in the past). */
  startsIn: number;
  content: Omit<AppointmentSeriesContentInput, "startsOn" | "timeZone" | "providerIds" | "toppedUpThrough">;
  /** Provider keys (`seeds/providers.ts`). */
  with?: string[];
  /** A visit changed on its own: the nth (from 0), moved by this many days and to this time. */
  moved?: { visit: number; days: number; time: string };
};

export const DEV_FAMILY_SERIES: SeedSeries[] = [
  {
    key: "dialysis",
    startsIn: -7,
    content: {
      kind: "event",
      rule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR",
      startTime: "06:00",
      allDay: false,
      title: "Dialysis",
      durationMinutes: 240,
      place: "Mercy General Hospital, dialysis unit (2nd floor)",
    },
    with: ["mercy"],
  },
  {
    key: "pt",
    startsIn: 1,
    content: {
      kind: "event",
      rule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TU;COUNT=12",
      startTime: "10:00",
      allDay: false,
      title: "Physical therapy",
      durationMinutes: 60,
      place: "Westside Family Medicine, rehab suite",
    },
    with: ["westside"],
    // The third visit moved to the Wednesday after, at 14:00.
    moved: { visit: 2, days: 1, time: "14:00" },
  },
];

const seriesId = (index: number) =>
  `0b6f3c1e-5d1a-4c2e-9a77-3f1d2bb3${String(1001 + index).padStart(4, "0")}`;

const providerIdIn = (groupId: string, key: string) => {
  const group = PROVIDER_GROUPS.find((g) => g.groupId === groupId);
  const index = group?.providers.findIndex((p) => p.key === key) ?? -1;
  if (!group || index < 0) throw new Error(`Seed series is with a missing provider: ${key}`);
  return group.providerId(index);
};

/** The series, their visits (content as the entry schema takes it) and links, for seeding at `now`. */
export const seriesRows = (now: number) => {
  const today = dayInZone(new Date(now), TIME_ZONE);
  const through = addDays(today, SERIES_AHEAD_DAYS);
  return DEV_FAMILY_SERIES.map((s, index) => {
    const id = seriesId(index);
    const providerIds = (s.with ?? []).map((key) => providerIdIn(DEV_GROUP_ID, key));
    const series = {
      id,
      groupId: DEV_GROUP_ID,
      recipientId: DEV_RECIPIENT_ID,
      ...s.content,
      startsOn: addDays(today, s.startsIn),
      timeZone: TIME_ZONE,
      providerIds,
      toppedUpThrough: through,
    };
    const visits = seriesVisits(
      { ...series, startTime: series.startTime ?? null, allDay: !!series.allDay },
      series.startsOn,
      through,
    ).map((visit, i) => {
      const moved = s.moved?.visit === i ? s.moved : null;
      const start = moved
        ? zonedInstant(addDays(visit.day, moved.days), moved.time, TIME_ZONE).toISOString()
        : visit.start;
      const end =
        moved && series.durationMinutes
          ? new Date(new Date(start).getTime() + series.durationMinutes * 60_000).toISOString()
          : visit.end;
      return {
        id: seriesVisitId(id, visit.day),
        content: {
          kind: series.kind,
          occurredAt: start,
          timeZone: TIME_ZONE,
          title: series.title ?? null,
          body: null,
          details: null,
          allDay: !!series.allDay,
          ...(series.kind === "event" && { endsAt: end, place: series.place ?? null }),
          seriesId: id,
          seriesDay: visit.day,
          seriesDetached: !!moved,
        },
      };
    });
    const links = visits.flatMap((v) =>
      providerIds.map((providerId) => ({
        id: entryProviderId(v.id, providerId),
        groupId: DEV_GROUP_ID,
        entryId: v.id,
        providerId,
      })),
    );
    return { series, visits, links };
  });
};

export const seed = async () => {
  const db = getDb();
  const [author] = await db
    .select({ id: userSchema.id })
    .from(userSchema)
    .where(eq(userSchema.email, AUTHOR));
  if (!author) return;
  const audits = { createdBy: author.id, updatedBy: author.id };

  for (const { series, visits, links } of seriesRows(Date.now())) {
    await db
      .insert(appointmentSeriesSchema)
      .values({ ...series, ...audits })
      .onConflictDoNothing({ target: appointmentSeriesSchema.id });
    // One statement per table, not per row: a seed run is mostly round trips (B-466).
    if (visits.length) {
      await db
        .insert(timelineEntrySchema)
        .values(
          visits.map((visit) => ({
            id: visit.id,
            groupId: series.groupId,
            recipientId: series.recipientId,
            ...visit.content,
            ...audits,
          })),
        )
        .onConflictDoNothing();
      const doc = noteDocFromText("");
      const snapshot = encodeNoteDoc(doc);
      doc.destroy();
      await db
        .insert(noteDocumentSchema)
        .values(
          visits.map((visit) => ({
            id: visit.id,
            groupId: series.groupId,
            subject: "entry" as const,
            entryId: visit.id,
            snapshot,
            text: "",
            ...audits,
          })),
        )
        .onConflictDoNothing({ target: noteDocumentSchema.id });
    }
    if (links.length) {
      await db
        .insert(timelineEntryProviderSchema)
        .values(links.map((link) => ({ ...link, ...audits })))
        .onConflictDoNothing({ target: timelineEntryProviderSchema.id });
    }
  }
};
