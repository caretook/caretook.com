import type { ImportResult } from "./providerImport";

import { describe, expect, it } from "vitest";
import { fromGroupHeading, importButtonLabel, importSummary, notesStayIn } from "./importWording";

const added = (id: string, practice: ImportResult["practice"] = null, practiceId: string | null = null) =>
  ({ sourceId: `s-${id}`, status: "added", id, practice, practiceId }) as const;
const here = (id: string) =>
  ({ sourceId: `s-${id}`, status: "alreadyHere", id, practice: null, practiceId: null }) as const;

describe("import wording", () => {
  it("names the group and the count", () => {
    expect(fromGroupHeading("Lou Lindqvist")).toBe("From Lou Lindqvist");
    expect(notesStayIn("Lou Lindqvist")).toBe("Provider notes stay in Lou Lindqvist.");
    expect(importButtonLabel(3)).toBe("Import 3");
  });

  it("summarises what was added and skipped", () => {
    expect(importSummary([added("a")])).toBe("Imported 1 provider.");
    expect(importSummary([added("a"), added("b"), here("c")])).toBe(
      "Imported 2 providers. 1 was already here.",
    );
    expect(importSummary([here("a"), here("b")])).toBe("Nothing imported: 2 were already here.");
    expect(importSummary([])).toBe("Nothing imported.");
  });

  it("counts a practice copied along with its clinicians once, and not when it was chosen too", () => {
    expect(importSummary([added("a", "copied", "p"), added("b", "copied", "p")])).toBe(
      "Imported 2 providers and 1 practice.",
    );
    expect(importSummary([added("a", "copied", "p"), added("p")])).toBe("Imported 2 providers.");
    expect(importSummary([added("a", "reused", "p")])).toBe("Imported 1 provider.");
  });
});
