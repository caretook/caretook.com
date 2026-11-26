import { describe, expect, it } from "vitest";
import { TAG_TARGETS, recordTagId, tagId, targetOf } from "../schema";
import { DEV_GROUP_ID } from "./careGroups";
import { seedRows } from "./tags";

describe("tag seeds", () => {
  it("derive every id, and put a tag on each target type", () => {
    const { tags, links } = seedRows();
    for (const tag of tags) expect(tag.id).toBe(tagId(DEV_GROUP_ID, tag.nameKey));
    const targets = links.map((link) => {
      const found = targetOf(link);
      expect(found).not.toBeNull();
      expect(link.id).toBe(recordTagId(link.tagId, found!.recordId));
      return found!.target;
    });
    expect(new Set(targets)).toEqual(new Set(TAG_TARGETS));
    expect(new Set(links.map((l) => l.id)).size).toBe(links.length);
  });
});
