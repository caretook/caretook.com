import { describe, expect, it } from "vitest";
import { announcementText, liveDocuments, liveDotLabel, listNames, writingLabel } from "./liveNow";

const doc = (id: string, ...edits: [string, string][]) => ({
  id,
  title: `Entry ${id}`,
  editors: edits.map(([userId, lastEditAt]) => ({ userId, lastEditAt })),
});

describe("listNames", () => {
  it("joins one, two and three names", () => {
    expect(listNames([])).toBe("");
    expect(listNames(["Maria"])).toBe("Maria");
    expect(listNames(["Maria", "Sam"])).toBe("Maria and Sam");
    expect(listNames(["Maria", "Sam", "Lee"])).toBe("Maria, Sam and Lee");
  });
});

describe("liveDocuments", () => {
  it("drops documents nobody else is writing in", () => {
    expect(liveDocuments([doc("a"), doc("b", ["u1", "2026-11-17T10:00:00.000Z"])]).map((d) => d.id)).toEqual([
      "b",
    ]);
  });

  it("puts the most recently edited first, by each document's latest editor", () => {
    const docs = [
      doc("old", ["u1", "2026-11-17T10:00:00.000Z"]),
      doc("new", ["u2", "2026-11-17T10:01:30.000Z"], ["u1", "2026-11-17T09:59:00.000Z"]),
      doc("mid", ["u3", "2026-11-17T10:01:00.000Z"]),
    ];
    expect(liveDocuments(docs).map((d) => d.id)).toEqual(["new", "mid", "old"]);
  });

  it("is empty for no documents", () => {
    expect(liveDocuments([])).toEqual([]);
  });
});

describe("labels", () => {
  it("names the writers", () => {
    expect(writingLabel(["Maria"])).toBe("Maria is writing");
    expect(writingLabel(["Maria", "Sam"])).toBe("Maria and Sam are writing");
    expect(liveDotLabel(["Maria"])).toBe("Being written now by Maria");
  });

  it("announces who is writing in which entry", () => {
    const names: Record<string, string> = { u1: "Maria" };
    expect(announcementText(doc("a", ["u1", "2026-11-17T10:00:00.000Z"]), (id) => names[id] ?? "?")).toBe(
      "Maria is writing: Entry a",
    );
  });
});
