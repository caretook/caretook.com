import type { LegalDocument } from "@caretook/data/domain";
import { LEGAL_DOCUMENTS } from "@caretook/data/domain";

// Where the legal pages open: the sign-up checkbox (`legalHref`) and account
// settings' Legal card (`legalLinks`). The web build serves them itself; the
// native build has no marketing pages, so they open on the web's origin
// (`VITE_API_ORIGIN`). Pure, imports no marketing code, tested.

export const legalHref = (document: LegalDocument, apiOrigin?: string | null) =>
  `${apiOrigin?.replace(/\/+$/, "") ?? ""}${LEGAL_DOCUMENTS[document].path}`;

/** Every legal page, in order, as `{ label, href }`. */
export const legalLinks = (apiOrigin?: string | null) =>
  (Object.keys(LEGAL_DOCUMENTS) as LegalDocument[]).map((document) => ({
    label: LEGAL_DOCUMENTS[document].label,
    href: legalHref(document, apiOrigin),
  }));
