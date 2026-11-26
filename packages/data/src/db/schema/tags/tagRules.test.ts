import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { GROUP_ROLE_NAMES } from "../../../constants/roles";
import { recordTagLinkZSchema } from "./recordTag";
import { tagCreateZSchema } from "./tag";
import {
  RECORD_TAG_NAMESPACE,
  TAG_NAMESPACE,
  TAG_TARGETS,
  activeTag,
  canCreateTag,
  canDeleteTag,
  canRenameTag,
  canTagRecord,
  isTagIdFor,
  nextTagId,
  recordTagId,
  tagFromParams,
  tagId,
  tagKey,
  tagName,
  tagNameZSchema,
  targetOf,
  withTagParam,
} from "./tagRules";

// The tags' pure rules (tags slice 1). Prior art: symptomCatalog.test.ts.

const GROUP = "0b6f3f1c-4c2e-4d7a-9a51-6e2d8c1f7a10";
const OTHER = "0b6f3f1c-4c2e-4d7a-9a51-6e2d8c1f7a11";
const V5 = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("tagKey", () => {
  it("folds case and spaces, and nothing else", () => {
    expect(tagKey("  Care   Home Move ")).toBe("care home move");
    expect(tagKey("urgent")).toBe(tagKey("Urgent "));
    expect(tagKey("URGENT\tnow")).toBe("urgent now");
    expect(tagKey("urgently")).not.toBe(tagKey("urgent"));
  });

  it("keeps the name's spelling for display, with single spaces", () => {
    expect(tagName("  Care   Home Move ")).toBe("Care Home Move");
  });

  it("names are 1 to 40 characters, after trimming", () => {
    expect(tagNameZSchema.parse("  Fall  follow-up ")).toBe("Fall follow-up");
    expect(tagNameZSchema.safeParse("   ").success).toBe(false);
    expect(tagNameZSchema.safeParse("x".repeat(40)).success).toBe(true);
    expect(tagNameZSchema.safeParse("x".repeat(41)).success).toBe(false);
  });
});

describe("tagId", () => {
  it("is stable, and a version 5 UUID", () => {
    expect(TAG_NAMESPACE).toBe("19faa300-620b-4ca1-b150-6e6d3826303c");
    expect(tagId(GROUP, "urgent")).toBe("a0809de1-bc8c-5121-9202-47f81ed4b174");
    expect(tagId(GROUP, "urgent")).toMatch(V5);
  });

  it("is the same for any spelling of the name and any case of the group", () => {
    expect(tagId(GROUP, "Urgent ")).toBe(tagId(GROUP, "urgent"));
    expect(tagId(GROUP.toUpperCase(), "urgent")).toBe(tagId(GROUP, "urgent"));
  });

  it("differs by group, name and counter", () => {
    expect(tagId(GROUP, "urgent")).not.toBe(tagId(OTHER, "urgent"));
    expect(tagId(GROUP, "urgent")).not.toBe(tagId(GROUP, "routine"));
    expect(tagId(GROUP, "urgent", 0)).not.toBe(tagId(GROUP, "urgent", 1));
    expect(tagId(GROUP, "urgent", 1)).not.toBe(tagId(GROUP, "urgent", 2));
  });
});

describe("nextTagId (the counter)", () => {
  it("is counter 0 when nothing holds it", () => {
    expect(nextTagId(GROUP, "Urgent", new Set())).toBe(tagId(GROUP, "urgent", 0));
    expect(nextTagId(GROUP, "Urgent", new Set([tagId(GROUP, "routine")]))).toBe(tagId(GROUP, "urgent", 0));
  });

  it("skips every taken id", () => {
    const taken = new Set([tagId(GROUP, "urgent", 0), tagId(GROUP, "urgent", 1), tagId(GROUP, "urgent", 3)]);
    expect(nextTagId(GROUP, "urgent", taken)).toBe(tagId(GROUP, "urgent", 2));
    taken.add(tagId(GROUP, "urgent", 2));
    expect(nextTagId(GROUP, "urgent", taken)).toBe(tagId(GROUP, "urgent", 4));
  });

  it("only ids a name could have pass as its id", () => {
    expect(isTagIdFor(GROUP, "Urgent", tagId(GROUP, "urgent", 7))).toBe(true);
    expect(isTagIdFor(GROUP, "Urgent", tagId(GROUP, "urgent", 7).toUpperCase())).toBe(true);
    expect(isTagIdFor(GROUP, "Urgent", tagId(OTHER, "urgent"))).toBe(false);
    expect(isTagIdFor(GROUP, "Urgent", randomUUID())).toBe(false);
  });

  it("is what a new tag's id must be", () => {
    const base = { groupId: GROUP, name: "Urgent" };
    expect(tagCreateZSchema.safeParse(base).success).toBe(true);
    expect(tagCreateZSchema.safeParse({ ...base, id: tagId(GROUP, "urgent", 2) }).success).toBe(true);
    const wrong = tagCreateZSchema.safeParse({ ...base, id: randomUUID() });
    expect(wrong.success ? [] : wrong.error.issues.map((i) => i.path.join("."))).toEqual(["id"]);
  });
});

describe("recordTagId", () => {
  const tag = randomUUID();
  const record = randomUUID();

  it("is stable, and a version 5 UUID", () => {
    expect(RECORD_TAG_NAMESPACE).toBe("37bf062e-a4b6-42b1-a4ce-d687ffdcfc7a");
    expect(recordTagId("4b0c3f5e-1d2a-4e6b-9c8d-7f0a1b2c3d4e", "9e8d7c6b-5a49-4382-a716-05f4e3d2c1b0")).toBe(
      "6ff10bcb-d2e5-5d3f-89c3-2dfdc5910db6",
    );
    expect(recordTagId(tag, record)).toBe(recordTagId(tag.toUpperCase(), record.toUpperCase()));
    expect(recordTagId(tag, record)).toMatch(V5);
  });

  it("differs by pair and by order", () => {
    expect(recordTagId(tag, record)).not.toBe(recordTagId(tag, randomUUID()));
    expect(recordTagId(tag, record)).not.toBe(recordTagId(randomUUID(), record));
    expect(recordTagId(tag, record)).not.toBe(recordTagId(record, tag));
  });

  it("a link names exactly one record, under its derived id", () => {
    const base = { groupId: GROUP, tagId: tag };
    expect(targetOf({ todoId: record })).toEqual({ target: "todo", recordId: record });
    expect(targetOf({})).toBeNull();
    expect(targetOf({ entryId: record, todoId: record })).toBeNull();
    expect(recordTagLinkZSchema.safeParse({ ...base, entryId: record }).success).toBe(true);
    expect(
      recordTagLinkZSchema.safeParse({
        ...base,
        id: recordTagId(tag, record),
        providerId: record,
        todoId: null,
      }).success,
    ).toBe(true);
    const paths = (input: object) => {
      const res = recordTagLinkZSchema.safeParse(input);
      return res.success ? [] : res.error.issues.map((i) => i.path.join("."));
    };
    expect(paths({ ...base, entryId: null })).toEqual(["target"]);
    expect(paths({ ...base, entryId: record, medicationId: randomUUID() })).toEqual(["target"]);
    expect(paths({ ...base, id: randomUUID(), entryId: record })).toEqual(["id"]);
  });
});

describe("canTagRecord", () => {
  const me = randomUUID();
  const someoneElse = randomUUID();
  const own = (target: (typeof TAG_TARGETS)[number]) => ({ target, createdBy: me });
  const theirs = (target: (typeof TAG_TARGETS)[number]) => ({ target, createdBy: someoneElse });

  it("owners, admins and caretakers tag any record", () => {
    for (const role of ["owner", "admin", "caretaker"])
      for (const target of TAG_TARGETS) {
        expect(canTagRecord(role, own(target), me)).toBe(true);
        expect(canTagRecord(role, theirs(target), me)).toBe(true);
      }
  });

  it("an Easy helper tags only a timeline entry they created", () => {
    expect(canTagRecord("easy_helper", own("entry"), me)).toBe(true);
    expect(canTagRecord("easy_helper", theirs("entry"), me)).toBe(false);
    expect(canTagRecord("easy_helper", { target: "entry", createdBy: null }, null)).toBe(false);
    for (const target of ["todo", "provider", "medication"] as const)
      expect(canTagRecord("easy_helper", own(target), me)).toBe(false);
  });

  it("viewers, Easy viewers and non-members never tag, a todo included", () => {
    for (const role of ["viewer", "easy_viewer", null, undefined, "stranger"])
      for (const target of TAG_TARGETS) expect(canTagRecord(role, own(target), me)).toBe(false);
  });

  it("covers every group role", () => {
    const tagging = GROUP_ROLE_NAMES.filter((role) => canTagRecord(role, own("entry"), me));
    expect(tagging).toEqual(["owner", "admin", "caretaker", "easy_helper"]);
  });

  it("anyone who may log creates a tag", () => {
    expect(GROUP_ROLE_NAMES.filter(canCreateTag)).toEqual(["owner", "admin", "caretaker", "easy_helper"]);
    expect(canCreateTag(null)).toBe(false);
  });
});

describe("canRenameTag and canDeleteTag", () => {
  const me = randomUUID();
  const own = { createdBy: me };
  const theirs = { createdBy: randomUUID() };

  it("owners, admins and caretakers rename any tag", () => {
    for (const role of ["owner", "admin", "caretaker"]) {
      expect(canRenameTag(role, own, me)).toBe(true);
      expect(canRenameTag(role, theirs, me)).toBe(true);
    }
  });

  it("an Easy helper renames only a tag they created", () => {
    expect(canRenameTag("easy_helper", own, me)).toBe(true);
    expect(canRenameTag("easy_helper", theirs, me)).toBe(false);
    expect(canRenameTag("easy_helper", { createdBy: null }, null)).toBe(false);
    expect(canRenameTag("easy_helper", own, null)).toBe(false);
  });

  it("viewers, Easy viewers and non-members never rename, even a tag they created", () => {
    for (const role of ["viewer", "easy_viewer", null, undefined, "stranger"])
      expect(canRenameTag(role, own, me)).toBe(false);
  });

  it("covers every group role", () => {
    expect(GROUP_ROLE_NAMES.filter((role) => canRenameTag(role, own, me))).toEqual([
      "owner",
      "admin",
      "caretaker",
      "easy_helper",
    ]);
    expect(GROUP_ROLE_NAMES.filter((role) => canRenameTag(role, theirs, me))).toEqual([
      "owner",
      "admin",
      "caretaker",
    ]);
  });

  it("only owners delete a tag", () => {
    expect(GROUP_ROLE_NAMES.filter(canDeleteTag)).toEqual(["owner"]);
    expect(canDeleteTag(null)).toBe(false);
  });
});

describe("?tag=", () => {
  const tag = randomUUID();

  it("reads a tag id, lowercased, and nothing else", () => {
    expect(tagFromParams(new URLSearchParams({ tag: tag.toUpperCase() }))).toBe(tag);
    expect(tagFromParams(new URLSearchParams())).toBeNull();
    expect(tagFromParams(new URLSearchParams({ tag: "urgent" }))).toBeNull();
    expect(tagFromParams(new URLSearchParams({ tag: "" }))).toBeNull();
  });

  it("sets and clears it, keeping the rest", () => {
    const set = withTagParam(new URLSearchParams({ who: "mine" }), tag);
    expect(set.toString()).toBe(`who=mine&tag=${tag}`);
    expect(withTagParam(set, null).toString()).toBe("who=mine");
  });

  it("an unknown or deleted tag is no filter", () => {
    const tags = [{ id: tag, name: "Urgent" }];
    expect(activeTag(tag, tags)).toEqual(tags[0]);
    expect(activeTag(randomUUID(), tags)).toBeNull();
    expect(activeTag(null, tags)).toBeNull();
  });
});
