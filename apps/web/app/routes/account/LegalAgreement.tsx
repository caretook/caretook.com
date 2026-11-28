import { LINK } from "~/components/ui/plain";
import { legalHref } from "~/lib/auth/legalLinks";
import { LEGAL_CHECKBOX_PARTS, LEGAL_DOCUMENTS } from "@caretook/data/domain";

/** The checkbox's sentence. Its links open in a new tab, so the form keeps what was typed. */
export function LegalAgreement() {
  return (
    <>
      {LEGAL_CHECKBOX_PARTS.map((part) =>
        typeof part === "string" ? (
          part
        ) : (
          <a
            key={part.document}
            className={LINK}
            href={legalHref(part.document, import.meta.env.VITE_API_ORIGIN)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {LEGAL_DOCUMENTS[part.document].label}
          </a>
        ),
      )}
    </>
  );
}
