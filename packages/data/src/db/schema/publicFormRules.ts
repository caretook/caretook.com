// The marketing site's public forms (marketing slice 4): their constants,
// labels and spam rules, with no imports at all, so the site's form
// components can use them without pulling Zod or drizzle into the page. The
// Zod schemas are in publicForms.ts, the tables in waitlistEntry.ts and
// contactMessage.ts.

export const CARING_FOR = ["parent", "spouse", "child", "sibling", "friend", "other"] as const;
export type CaringFor = (typeof CARING_FOR)[number];

export const CONTACT_TOPICS = ["question", "help", "privacy", "other"] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number];

export const HEARD_FROM_MAX = 200;
export const CONTACT_MESSAGE_MAX = 5000;
export const NAME_MAX = 100;
export const EMAIL_MAX = 254;
export const SOURCE_FIELD_MAX = 200;

// ---------------------------------------------------------------------------
// Spam rules: a honeypot field and a minimum time on the page. A submission
// that trips either is answered with the usual thanks and stores nothing, so
// a bot learns nothing. (The per-IP rate limit is the API's.)
// ---------------------------------------------------------------------------

/** The honeypot: a field people never see. Anything typed in it is a bot. */
export const HONEYPOT_FIELD = "website";

/** A form sent sooner than this after the page showed it is a bot's. */
export const MIN_FORM_MS = 3000;

export type SpamVerdict = "ok" | "honeypot" | "tooFast";

/**
 * Whether a submission looks like a person's. The honeypot wins; a missing
 * time counts as too fast (a real form always sends it).
 */
export const spamVerdict = (
  guard: { website?: string | null; elapsedMs?: number | null },
  minMs: number = MIN_FORM_MS,
): SpamVerdict => {
  if (guard.website?.trim()) return "honeypot";
  if (guard.elapsedMs == null || !Number.isFinite(guard.elapsedMs) || guard.elapsedMs < minMs)
    return "tooFast";
  return "ok";
};

/** Where someone joined the waitlist from: the page and any UTM parameters in its URL. */
export type WaitlistSource = {
  page?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
};

/** The UTM parameters a waitlist source keeps, by their URL name. */
export const UTM_PARAMS = {
  utm_source: "utmSource",
  utm_medium: "utmMedium",
  utm_campaign: "utmCampaign",
  utm_term: "utmTerm",
  utm_content: "utmContent",
} as const satisfies Record<string, Exclude<keyof WaitlistSource, "page">>;

/** A topic as the form and the support email name it. */
export const CONTACT_TOPIC_LABELS: Record<ContactTopic, string> = {
  question: "A question",
  help: "Help with Caretook",
  privacy: "Privacy or my data",
  other: "Something else",
};

/** Who someone cares for, as the waitlist form offers it. */
export const CARING_FOR_LABELS: Record<CaringFor, string> = {
  parent: "A parent",
  spouse: "A spouse or partner",
  child: "A child",
  sibling: "A sibling",
  friend: "A friend or neighbor",
  other: "Someone else",
};
