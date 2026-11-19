import type { CodeStatus } from "@caretook/data/schema";

import { dayInZone } from "./zonedDay";

// How a care recipient's profile reads (profiles): the age, the birthday, and
// the labels for the medical basics. Pure, so web:unit tests it; the profile
// page, its sheets and the timeline's recipient card all use it.

/** What a viewer sees in place of the writers' details. */
export const VIEWER_DETAILS_LINE = "More details are visible to caretakers.";

/** What an edit control says without a connection (profile writes are online only). */
export const PROFILE_NEEDS_CONNECTION = "Needs a connection to edit.";

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Whole years from a "YYYY-MM-DD" birthday to a "YYYY-MM-DD" day, or null for
 * a birthday that isn't a date or is after the day. A Feb 29 birthday turns
 * a year older on Mar 1 in years without one.
 */
export const ageOn = (dateOfBirth: string, day: string): number | null => {
  const born = DATE.exec(dateOfBirth);
  const today = DATE.exec(day);
  if (!born || !today) return null;
  const [by, bm, bd] = born.slice(1).map(Number) as [number, number, number];
  const [ty, tm, td] = today.slice(1).map(Number) as [number, number, number];
  const check = new Date(Date.UTC(by, bm - 1, bd));
  if (check.getUTCMonth() !== bm - 1 || check.getUTCDate() !== bd) return null;
  const age = ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
  return age < 0 ? null : age;
};

/**
 * "Age 87", counted on the recipient's own day (their time zone), so it turns
 * over on their birthday wherever the reader is. Null without a birthday, or
 * for one in the future.
 */
export const ageText = (
  dateOfBirth: string | null | undefined,
  timeZone: string | null | undefined,
  now: Date,
): string | null => {
  if (!dateOfBirth) return null;
  let day: string;
  try {
    day = dayInZone(now, timeZone || "UTC");
  } catch {
    day = dayInZone(now, "UTC");
  }
  const age = ageOn(dateOfBirth, day);
  return age === null ? null : `Age ${age}`;
};

/** A stored birthday (`1941-03-09`) as a long date ("March 9, 1941"), whatever the device's zone. */
export const birthdayText = (value: string, locale?: string) => {
  const date = new Date(`${value}T00:00:00Z`);
  if (!DATE.test(value) || Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale, { timeZone: "UTC", dateStyle: "long" });
};

export const CODE_STATUS_LABELS: Record<CodeStatus, string> = {
  fullCode: "Full code",
  dnr: "DNR",
  dnrPolst: "DNR/POLST",
};

/** A code status for people; a value this build doesn't know shows as it is. */
export const codeStatusLabel = (value: string | null | undefined) =>
  value ? (CODE_STATUS_LABELS[value as CodeStatus] ?? value) : null;

/** What a screen reader says for a blood type ("A positive"), since "A+" reads as "A plus". */
export const bloodTypeSpoken = (value: string) => {
  const sign = value.endsWith("+") ? "positive" : value.endsWith("-") ? "negative" : null;
  return sign ? `${value.slice(0, -1)} ${sign}` : value;
};

/** A blood type as written ("O−", with a real minus sign). */
export const bloodTypeLabel = (value: string | null | undefined) =>
  value ? (value.endsWith("-") ? `${value.slice(0, -1)}−` : value) : null;

export type BasicsInput = {
  codeStatus: string | null;
  bloodType: string | null;
  primaryLanguage: string | null;
  pronouns: string | null;
};

export type BasicLine = {
  id: "codeStatus" | "bloodType" | "primaryLanguage" | "pronouns";
  label: string;
  value: string;
  /** What a screen reader says, when it differs from `value`. */
  spoken?: string;
};

/** The Basics card's lines, in order, each only when set. */
export const basicLines = (recipient: BasicsInput): BasicLine[] => {
  const lines: BasicLine[] = [];
  const code = codeStatusLabel(recipient.codeStatus);
  if (code) lines.push({ id: "codeStatus", label: "Code status", value: code });
  const blood = bloodTypeLabel(recipient.bloodType);
  if (blood && recipient.bloodType)
    lines.push({
      id: "bloodType",
      label: "Blood type",
      value: blood,
      spoken: bloodTypeSpoken(recipient.bloodType),
    });
  const language = recipient.primaryLanguage?.trim();
  if (language) lines.push({ id: "primaryLanguage", label: "Primary language", value: language });
  const pronouns = recipient.pronouns?.trim();
  if (pronouns) lines.push({ id: "pronouns", label: "Pronouns", value: pronouns });
  return lines;
};
