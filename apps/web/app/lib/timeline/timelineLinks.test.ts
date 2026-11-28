import { describe, expect, it } from "vitest";
import { dayLinkPath, entryLinkPath } from "./timelineLinks";

const GROUP = "00000000-0000-4000-8000-000000000001";
const ID = "00000000-0000-4000-8000-000000000002";

describe("timeline links", () => {
  it("links a day to its ?day= jump", () => {
    expect(dayLinkPath(GROUP, "2027-06-07")).toBe(`/app/groups/${GROUP}/timeline?day=2027-06-07`);
  });

  it("links a note or event to its page", () => {
    for (const kind of ["note", "event"] as const)
      expect(
        entryLinkPath({ id: ID, groupId: GROUP, kind, occurredAt: "2027-06-07T18:00:00.000Z" }, "UTC"),
      ).toBe(`/app/groups/${GROUP}/entries/${ID}`);
  });

  it("links a symptom to its day in the viewer's zone", () => {
    const symptom = {
      id: ID,
      groupId: GROUP,
      kind: "symptom" as const,
      occurredAt: "2027-06-08T02:00:00.000Z",
    };
    expect(entryLinkPath(symptom, "America/Los_Angeles")).toBe(
      `/app/groups/${GROUP}/timeline?day=2027-06-07`,
    );
    expect(entryLinkPath(symptom, "UTC")).toBe(`/app/groups/${GROUP}/timeline?day=2027-06-08`);
  });
});
