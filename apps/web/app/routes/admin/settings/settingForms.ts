import type { Announcement, AppSettingKey } from "@caretook/data/schema";

import { APP_SETTINGS } from "@caretook/data/schema";

// The pure parts of /admin/settings: which form each setting gets, how a
// posted form becomes the setting's value, and how a value reads. The
// server checks the value against the registry again; this only turns form
// strings into the value's shape. Unit-tested in web:unit.

export type SettingForm = "switch" | "number" | "list" | "announcement";

/** The form each setting gets. Typed per key, so a new key needs a form here. */
export const SETTING_FORMS: Record<AppSettingKey, SettingForm> = {
  "signup.accessCodes": "switch",
  "signup.linkInvites": "switch",
  "signup.emailInvites": "switch",
  announcement: "announcement",
  "mail.allowlist": "list",
  "invites.linkDefaultDays": "number",
  "invites.linkMaxDays": "number",
  "invites.linkMaxUses": "number",
  "publicForms.perMinute": "number",
};

export type Parsed =
  { ok: true; value: unknown } | { ok: false; issues: { path: string; message: string }[] };

const wholeNumber = (value: string) => (/^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN);

/**
 * A `datetime-local` value ("2026-11-20T18:30"), read as UTC, as ISO 8601;
 * null when empty, undefined when it isn't a time.
 */
export const utcFromLocalInput = (value: string): string | null | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) return undefined;
  const at = Date.parse(`${trimmed}${trimmed.length === 16 ? ":00" : ""}Z`);
  return Number.isNaN(at) ? undefined : new Date(at).toISOString();
};

/** An ISO time as a `datetime-local` value in UTC ("2026-11-20T18:30"). */
export const localInputFromUtc = (iso: string | null | undefined) => (iso ? iso.slice(0, 16) : "");

/**
 * The posted form as `key`'s value. Fields: `value` (switch: "on" | "off";
 * number; list: one entry per line or comma, empty for the environment's),
 * and for the announcement `text` (empty clears it), `tone` and `endsAt`
 * (UTC, optional).
 */
export const settingFromForm = (key: AppSettingKey, field: (name: string) => string): Parsed => {
  const form = SETTING_FORMS[key];
  if (form === "switch") {
    const value = field("value");
    if (value !== "on" && value !== "off")
      return { ok: false, issues: [{ path: "value", message: "Choose on or off." }] };
    return { ok: true, value: value === "on" };
  }
  if (form === "number") {
    const value = wholeNumber(field("value"));
    if (Number.isNaN(value))
      return { ok: false, issues: [{ path: "value", message: "Use a whole number." }] };
    return { ok: true, value };
  }
  if (form === "list") {
    const entries = field("value")
      .split(/[\n,]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    return { ok: true, value: entries.length ? entries : null };
  }
  const text = field("text").trim();
  if (!text) return { ok: true, value: null };
  const endsAt = utcFromLocalInput(field("endsAt"));
  if (endsAt === undefined)
    return { ok: false, issues: [{ path: "endsAt", message: "Use a date and time." }] };
  return { ok: true, value: { text, tone: field("tone"), endsAt } };
};

/**
 * The server's issue paths are relative to the value ("", "0", "text"); the
 * form's fields are `value` and the announcement's own names.
 */
export const formIssuePath = (key: AppSettingKey, path: string) => {
  if (SETTING_FORMS[key] === "announcement") return path || "text";
  return path === "reason" ? "reason" : "value";
};

const utcText = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;

/** How a value reads on the page ("On", "7", "dev@example.com, @team.example", "None"). */
export const settingValueText = (key: AppSettingKey, value: unknown): string => {
  const form = SETTING_FORMS[key];
  if (form === "switch") return value ? "On" : "Off";
  if (form === "number") return String(value);
  if (form === "list") {
    if (value == null) return APP_SETTINGS[key].defaultText;
    const list = value as string[];
    return list.length ? list.join(", ") : "Nobody";
  }
  const announcement = value as Announcement | null;
  if (!announcement) return "None";
  const ends = announcement.endsAt ? ` · until ${utcText(announcement.endsAt)}` : "";
  return `${announcement.tone === "warning" ? "Warning" : "Info"}: ${announcement.text}${ends}`;
};
