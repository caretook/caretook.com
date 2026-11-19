import { z } from "zod";
import { LINK_MAX_USES_LIMIT, LINK_TTL_DEFAULT_DAYS, LINK_TTL_MAX_DAYS } from "./inviteRules";

// The app settings registry (admin PRD): everything staff can change without
// a deploy. Pure and client-safe: the settings service validates with it,
// the consumers read their key's type from it, and /admin/settings renders a
// form per key from it. Typed per key (never `Record<string, …>`), so
// `getSetting("signup.accessCodes")` is a boolean and an unknown key is a
// type error. A key without a stored row has its `default`. Append new keys
// at the end; never rename one (stored rows are keyed by it).

/** One setting: its value's schema, its default, whether anyone may read it, and how /admin describes it. */
type SettingSpec<S extends z.ZodType> = {
  schema: S;
  default: z.output<S>;
  /** Readable without signing in (only the announcement: `public.announcement`). */
  public: boolean;
  label: string;
  help: string;
  /** How the default reads on the settings page ("On", "7 days", "From MAIL_ALLOWLIST"). */
  defaultText: string;
};

const define = <S extends z.ZodType>(spec: SettingSpec<S>) => spec;

const SWITCH = z.boolean();

/** An allowlist entry: a full address or an `@domain`, trimmed and lowercased. */
export const allowlistEntryZ = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .refine((v) => /^@[a-z0-9.-]+\.[a-z]{2,}$/.test(v) || z.email().safeParse(v).success, {
    message: "Use a full address or an @domain",
  });

export const ANNOUNCEMENT_TONES = ["info", "warning"] as const;
export type AnnouncementTone = (typeof ANNOUNCEMENT_TONES)[number];
export const ANNOUNCEMENT_MAX = 280;

/** The `/app` banner: its text, its tone, and when it stops showing (none: until it's cleared). */
export const announcementZ = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Write the announcement")
    .max(ANNOUNCEMENT_MAX, `At most ${ANNOUNCEMENT_MAX} characters`),
  tone: z.enum(ANNOUNCEMENT_TONES),
  endsAt: z.iso.datetime({ offset: true }).nullish(),
});
export type Announcement = z.output<typeof announcementZ>;

/** The hard limits the settings move within (the link limits are inviteRules' own). */
const LINK_DAYS_LIMIT = LINK_TTL_MAX_DAYS;
const LINK_USES_LIMIT = LINK_MAX_USES_LIMIT;
export const PUBLIC_FORMS_RATE_LIMIT = 1000;

const wholeNumber = (min: number, max: number) =>
  z.int("Use a whole number").min(min, `At least ${min}`).max(max, `At most ${max}`);

export const APP_SETTINGS = {
  "signup.accessCodes": define({
    schema: SWITCH,
    default: true,
    public: false,
    label: "Access-code sign-up",
    help: "New accounts and care groups from an access code (/join/…).",
    defaultText: "On",
  }),
  "signup.linkInvites": define({
    schema: SWITCH,
    default: true,
    public: false,
    label: "Invite links",
    help: "Owners and admins making invite links, and people asking to join with one.",
    defaultText: "On",
  }),
  "signup.emailInvites": define({
    schema: SWITCH,
    default: true,
    public: false,
    label: "Email invites",
    help: "Owners and admins (and staff) inviting someone by email, and those invites being used.",
    defaultText: "On",
  }),
  announcement: define({
    schema: announcementZ.nullable(),
    default: null,
    public: true,
    label: "Announcement",
    help: "A banner at the top of the app, until its end time or until it's cleared.",
    defaultText: "None",
  }),
  "mail.allowlist": define({
    // Null: MAIL_ALLOWLIST from the environment.
    schema: z.array(allowlistEntryZ).max(100, "At most 100 entries").nullable(),
    default: null,
    public: false,
    label: "Email allowlist",
    help: "Outside production, the only addresses (or @domains) that get real email. Production ignores it.",
    defaultText: "From MAIL_ALLOWLIST",
  }),
  "invites.linkDefaultDays": define({
    schema: wholeNumber(1, LINK_DAYS_LIMIT),
    default: LINK_TTL_DEFAULT_DAYS,
    public: false,
    label: "Invite link: default days",
    help: "How long a new invite link works unless its maker picks otherwise.",
    defaultText: `${LINK_TTL_DEFAULT_DAYS} days`,
  }),
  "invites.linkMaxDays": define({
    schema: wholeNumber(1, LINK_DAYS_LIMIT),
    default: LINK_DAYS_LIMIT,
    public: false,
    label: "Invite link: longest days",
    help: "The longest an owner or admin may make an invite link work.",
    defaultText: `${LINK_DAYS_LIMIT} days`,
  }),
  "invites.linkMaxUses": define({
    schema: wholeNumber(1, LINK_USES_LIMIT),
    default: LINK_USES_LIMIT,
    public: false,
    label: "Invite link: most uses",
    help: "The most uses an owner or admin may put on one invite link (no limit stays allowed).",
    defaultText: String(LINK_USES_LIMIT),
  }),
  "publicForms.perMinute": define({
    schema: wholeNumber(1, PUBLIC_FORMS_RATE_LIMIT),
    default: 10,
    public: false,
    label: "Public forms: per minute",
    help: "Waitlist and contact submissions allowed per IP address per form in any minute.",
    defaultText: "10",
  }),
} as const;

export type AppSettingKey = keyof typeof APP_SETTINGS;
export type AppSettingValue<K extends AppSettingKey> = z.output<(typeof APP_SETTINGS)[K]["schema"]>;
export type AppSettingValues = { [K in AppSettingKey]: AppSettingValue<K> };

export const APP_SETTING_KEYS = Object.keys(APP_SETTINGS) as AppSettingKey[];

export const isAppSettingKey = (value: unknown): value is AppSettingKey =>
  typeof value === "string" && Object.hasOwn(APP_SETTINGS, value);

/** The sign-up paths a switch can close, and their keys. */
export const SIGNUP_SWITCHES = {
  accessCodes: "signup.accessCodes",
  linkInvites: "signup.linkInvites",
  emailInvites: "signup.emailInvites",
} as const satisfies Record<string, AppSettingKey>;
export type SignupPath = keyof typeof SIGNUP_SWITCHES;

/** What a switched-off path tells the person trying it. */
export const SIGNUP_CLOSED_MESSAGE = "This isn't available right now. Try again later.";

/**
 * `value` checked against `key`'s schema: the parsed value, or the issues
 * (paths relative to the value).
 */
export const parseAppSetting = <K extends AppSettingKey>(
  key: K,
  value: unknown,
): { ok: true; value: AppSettingValue<K> } | { ok: false; issues: { path: string; message: string }[] } => {
  const parsed = (APP_SETTINGS[key].schema as z.ZodType).safeParse(value);
  if (parsed.success) return { ok: true, value: parsed.data as AppSettingValue<K> };
  return {
    ok: false,
    issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
  };
};

/** A stored value, or the default when there's none or it no longer fits the schema. */
export const storedOrDefault = <K extends AppSettingKey>(key: K, stored: unknown): AppSettingValue<K> => {
  if (stored === undefined) return APP_SETTINGS[key].default as AppSettingValue<K>;
  const parsed = parseAppSetting(key, stored);
  return parsed.ok ? parsed.value : (APP_SETTINGS[key].default as AppSettingValue<K>);
};

/** The link limits invite links follow, from the three settings. The default never exceeds the longest. */
export const linkLimits = (values: {
  defaultDays: number;
  maxDays: number;
  maxUses: number;
}): { defaultDays: number; maxDays: number; maxUses: number } => ({
  defaultDays: Math.min(values.defaultDays, values.maxDays),
  maxDays: values.maxDays,
  maxUses: values.maxUses,
});
export type LinkLimits = ReturnType<typeof linkLimits>;

/**
 * The announcement while it's showing: none once `endsAt` has passed (an end
 * time is exclusive), and none when there's no text. Used by
 * `public.announcement` and by the device's banner rule.
 */
export const activeAnnouncement = <A extends Pick<Announcement, "text" | "endsAt">>(
  announcement: A | null | undefined,
  now: number,
): A | null => {
  if (!announcement?.text.trim()) return null;
  if (announcement.endsAt) {
    const ends = Date.parse(announcement.endsAt);
    if (Number.isNaN(ends) || ends <= now) return null;
  }
  return announcement;
};
