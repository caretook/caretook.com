import { describe, expect, it } from "vitest";

import { content as healthData } from "../health-data-privacy/content";
import { content as privacy } from "../privacy/content";
import { content as terms } from "../terms/content";
import { LEGAL_VERSIONS, legalCheckboxText } from "@caretook/data/domain";

// An acceptance names each document's version, so a page edit that moves its
// last-updated date has to move the version with it.
describe("legal versions", () => {
  it("equal the legal pages' last-updated dates", () => {
    expect(LEGAL_VERSIONS.terms).toBe(terms.lastUpdated);
    expect(LEGAL_VERSIONS.privacy).toBe(privacy.lastUpdated);
    expect(LEGAL_VERSIONS.healthDataPrivacy).toBe(healthData.lastUpdated);
  });

  it("the checkbox names 18+ and all three documents", () => {
    expect(legalCheckboxText()).toBe(
      "I'm 18 or older and I agree to the Terms, the Privacy Policy and the Consumer Health Data Privacy Policy.",
    );
  });
});
