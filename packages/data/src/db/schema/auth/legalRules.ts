// What someone agrees to when they sign up: the versions of the three legal
// documents and of the checkbox's words. Pure and client-safe. A document's
// version is its page's last-updated date, and a unit test holds them equal
// (apps/web/app/routes/marketing/sections/legalVersions.test.ts), so a page
// can't change unversioned. Change `wording` when the words below change.

export const LEGAL_VERSIONS = {
  terms: "2026-11-18",
  privacy: "2026-11-20",
  healthDataPrivacy: "2026-11-20",
  wording: "2026-11-23",
} as const;

export const LEGAL_DOCUMENTS = {
  terms: { label: "Terms", path: "/terms" },
  privacy: { label: "Privacy Policy", path: "/privacy" },
  healthDataPrivacy: { label: "Consumer Health Data Privacy Policy", path: "/health-data-privacy" },
} as const;

export type LegalDocument = keyof typeof LEGAL_DOCUMENTS;

/** The checkbox's sentence, in order: plain text, and the documents it links. */
export const LEGAL_CHECKBOX_PARTS: readonly (string | { document: LegalDocument })[] = [
  "I'm 18 or older and I agree to the ",
  { document: "terms" },
  ", the ",
  { document: "privacy" },
  " and the ",
  { document: "healthDataPrivacy" },
  ".",
];

/** The checkbox's sentence as plain text. */
export const legalCheckboxText = () =>
  LEGAL_CHECKBOX_PARTS.map((part) =>
    typeof part === "string" ? part : LEGAL_DOCUMENTS[part.document].label,
  ).join("");

/** Shown when the box isn't ticked. */
export const LEGAL_REQUIRED_MESSAGE = "Tick the box to continue.";
