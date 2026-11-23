import type { LegalDocument } from "@caretook/data/schema";

import { LEGAL_DOCUMENTS } from "@caretook/data/schema";

// Where a legal document opens. The web build serves them itself; the native
// build has no marketing pages, so they open on the web's origin
// (`VITE_API_ORIGIN`). Pure, tested.

export const legalHref = (document: LegalDocument, apiOrigin?: string | null) =>
  `${apiOrigin?.replace(/\/+$/, "") ?? ""}${LEGAL_DOCUMENTS[document].path}`;
