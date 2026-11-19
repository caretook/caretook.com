import type { CaringFor, WaitlistSource } from "@caretook/data/schema";

import { CARING_FOR_LABELS } from "@caretook/data/schema";

// The waitlist's CSV export (marketing slice 5): RFC 4180, UTF-8 with a byte
// order mark (so spreadsheet apps read accents and emoji right), CRLF line
// ends. Visitors typed these values, so a cell a spreadsheet would run as a
// formula (=, +, -, @, tab or CR first) is prefixed with an apostrophe.

/** One CSV cell: quoted when it holds a comma, quote or line break, quotes doubled. */
export const csvField = (value: string | null | undefined): string => {
  let text = value ?? "";
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

/** Rows of cells as CSV text: CRLF between and after rows. */
export const toCsv = (rows: readonly (readonly (string | null | undefined)[])[]) =>
  rows.map((row) => row.map(csvField).join(",") + "\r\n").join("");

/** What the export needs of an entry (the API's waitlist DTO). */
export type WaitlistCsvEntry = {
  email: string;
  firstName: string | null;
  caringFor: CaringFor | null;
  heardFrom: string | null;
  source: WaitlistSource | null;
  createdAt: string;
};

export const WAITLIST_CSV_HEADER = [
  "Joined (UTC)",
  "Email",
  "First name",
  "Cares for",
  "How they heard",
  "Page",
  "UTM source",
  "UTM medium",
  "UTM campaign",
  "UTM term",
  "UTM content",
] as const;

/** The export file's text: a byte order mark, the header, then one row per entry, in order. */
export const waitlistCsv = (entries: readonly WaitlistCsvEntry[]) =>
  "﻿" +
  toCsv([
    WAITLIST_CSV_HEADER,
    ...entries.map((e) => [
      e.createdAt,
      e.email,
      e.firstName,
      e.caringFor ? CARING_FOR_LABELS[e.caringFor] : "",
      e.heardFrom,
      e.source?.page,
      e.source?.utmSource,
      e.source?.utmMedium,
      e.source?.utmCampaign,
      e.source?.utmTerm,
      e.source?.utmContent,
    ]),
  ]);

/** The export's file name, dated by `now` (UTC). */
export const waitlistCsvFileName = (now: Date) => `caretook-waitlist-${now.toISOString().slice(0, 10)}.csv`;
