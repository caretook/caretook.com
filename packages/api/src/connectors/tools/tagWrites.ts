import type { TagTarget } from "@caretook/data";
import type { ToolContext } from "../registry";

import {
  canTagRecord,
  isError,
  isSymptomDetails,
  medicationService,
  medicationTitle,
  newError,
  providerService,
  recordTagService,
  rejectError,
  TAG_TARGET_FIELDS,
  TAG_TARGETS,
  tagKey,
  tagNameZSchema,
  tagService,
  timelineEntryModel,
  todoService,
} from "@caretook/data";
import { z } from "zod";
import { entryPath, linkTo, medicationPath, providerPath, todoPath } from "../links";
import { defineTool, WRITE_ANNOTATIONS } from "../registry";
import { asMember } from "./shared";
import { byTagName, resolveTag } from "./tagSupport";

// tag_record and untag_record (connectors-5): a member's assistant puts the
// group's tags on a timeline entry, todo, provider or medication, or takes
// them off, as the member. The record is checked first (live, in the grant's
// group, `canTagRecord` for the member's role and its `created_by`), so a
// refusal leaves nothing behind. Then each name is the group's tag by key,
// else a new one (`tagService.create`: derived id, server-picked color), and
// `recordTagService.link`; untagging is `unlinkPair` and never deletes a tag.
// Derived ids make a retry safe. A link failing after the check (a race) can
// leave a new tag carrying nothing, as the app's picker can.

const TAGS_MAX = 10;

const recordInput = {
  target: z
    .enum(TAG_TARGETS)
    .describe(
      "What the record is: entry (a timeline entry; an event is one too), todo, provider or medication.",
    ),
  recordId: z
    .uuid()
    .describe(
      "The record's id, from list_timeline, list_todos, list_providers, list_medications, search or tagged_items.",
    ),
};

const tagNames = (what: string) => z.array(tagNameZSchema).min(1).max(TAGS_MAX).describe(what);

/** A record's title, for the answer. */
const ENTRY_TITLES: Record<string, string> = {
  note: "Note",
  symptom: "Symptom",
  event: "Event",
  vital: "Vitals",
  dose: "Dose",
  medicationChange: "Medication change",
  conditionChange: "Condition change",
};

type Found = { title: string; createdBy: string | null; url: string };

/** The record as the member sees it, live and in the grant's group, or the refusal. */
const findRecord = async (ctx: ToolContext, target: TagTarget, recordId: string) => {
  const member = asMember(ctx);
  const url = (path: string) => linkTo(ctx.origin, path);
  let found: (Found & { groupId: string }) | null = null;
  switch (target) {
    case "entry": {
      const e = await timelineEntryModel.getById(recordId, member);
      if (isError(e)) return e;
      if (e)
        found = {
          groupId: e.groupId,
          createdBy: e.createdBy,
          title:
            e.title?.trim() ||
            (isSymptomDetails(e.details) ? e.details.name : null) ||
            (ENTRY_TITLES[e.kind] ?? e.kind),
          url: url(entryPath(ctx.groupId, e)),
        };
      break;
    }
    case "todo": {
      const t = await todoService.getById(member, recordId);
      if (isError(t)) return t;
      if (t) found = { ...t, title: t.title, url: url(todoPath(ctx.groupId, t.id)) };
      break;
    }
    case "provider": {
      const p = await providerService.getById(member, recordId);
      if (isError(p)) return p;
      if (p) found = { ...p, title: p.name, url: url(providerPath(ctx.groupId, p.id)) };
      break;
    }
    case "medication": {
      const m = await medicationService.getById(member, recordId);
      if (isError(m)) return m;
      if (m) found = { ...m, title: medicationTitle(m), url: url(medicationPath(ctx.groupId, m.id)) };
      break;
    }
  }
  // Another group's record (an owner of two can see it) is not this group's to tag.
  if (!found || found.groupId !== ctx.groupId) return newError({ code: "recordTagService:recordNotFound" });
  if (!canTagRecord(ctx.role, { target, createdBy: found.createdBy }, ctx.authUser.id))
    return rejectError(ctx.authUser);
  return { title: found.title, createdBy: found.createdBy, url: found.url } satisfies Found;
};

/** The names once each, by key, in the order given. */
const distinct = (names: readonly string[]) => {
  const seen = new Set<string>();
  return names.filter((name) => {
    const key = tagKey(name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/** The tag ids a record carries now. */
const carried = async (ctx: ToolContext, target: TagTarget, recordId: string) => {
  const links = await recordTagService.listForRecord(asMember(ctx), target, recordId);
  if (isError(links)) return links;
  return new Set(links.data.filter((l) => l.groupId === ctx.groupId).map((l) => l.tagId));
};

const list = (names: readonly string[]) => [...names].sort(byTagName).join(", ");

export const tagRecord = defineTool({
  name: "tag_record",
  title: "Tag a record",
  description: `Put tags on a timeline entry (events too), todo, provider or medication: give its kind, its id and 1 to ${TAGS_MAX} tag names. A name the group already has (any case) is that tag, so check list_tags first and use its names; a new name adds a tag to the group's list. A tag the record already has is left as it is. Ask the member before calling.`,
  scope: "readWrite",
  input: z.object({
    ...recordInput,
    tags: tagNames('The tag names, like "Urgent" or "Cardiology prep".'),
  }),
  annotations: WRITE_ANNOTATIONS,
  handler: async (args, ctx) => {
    const record = await findRecord(ctx, args.target, args.recordId);
    if (isError(record)) return record;
    const had = await carried(ctx, args.target, args.recordId);
    if (isError(had)) return had;

    const added: string[] = [];
    const created: string[] = [];
    const alreadyHad: string[] = [];
    for (const name of distinct(args.tags)) {
      let tag = await resolveTag(ctx, name);
      if (isError(tag)) return tag;
      if (!tag) {
        tag = await tagService.create(asMember(ctx), { groupId: ctx.groupId, name });
        if (isError(tag)) return tag;
        if (!tag) return newError({ code: "tagService:notFound" });
        created.push(tag.name);
      }
      if (had.has(tag.id)) {
        alreadyHad.push(tag.name);
        continue;
      }
      const linked = await recordTagService.link(asMember(ctx), {
        groupId: ctx.groupId,
        tagId: tag.id,
        [TAG_TARGET_FIELDS[args.target]]: args.recordId,
      });
      if (isError(linked)) return linked;
      had.add(tag.id);
      added.push(tag.name);
    }

    const lines = [
      added.length
        ? `Tagged ${record.title} with ${list(added)}${created.length ? ` (new tag${created.length === 1 ? "" : "s"}: ${list(created)})` : ""}.`
        : `Nothing added to ${record.title}.`,
      ...(alreadyHad.length ? [`It already had ${list(alreadyHad)}.`] : []),
      record.url,
    ];
    return {
      text: lines.join("\n"),
      structured: {
        target: args.target,
        recordId: args.recordId,
        title: record.title,
        added: [...added].sort(byTagName),
        newTags: [...created].sort(byTagName),
        alreadyHad: [...alreadyHad].sort(byTagName),
        url: record.url,
      },
    };
  },
});

export const untagRecord = defineTool({
  name: "untag_record",
  title: "Untag a record",
  description: `Take tags off a timeline entry (events too), todo, provider or medication: give its kind, its id and 1 to ${TAGS_MAX} tag names (any case). The tags stay in the group's list. A name the record doesn't carry, or the group doesn't have, is named in the answer and changes nothing. Ask the member before calling.`,
  scope: "readWrite",
  input: z.object({
    ...recordInput,
    tags: tagNames("The tag names to take off."),
  }),
  annotations: WRITE_ANNOTATIONS,
  handler: async (args, ctx) => {
    const record = await findRecord(ctx, args.target, args.recordId);
    if (isError(record)) return record;
    const had = await carried(ctx, args.target, args.recordId);
    if (isError(had)) return had;

    const removed: string[] = [];
    const notCarried: string[] = [];
    const notFound: string[] = [];
    for (const name of distinct(args.tags)) {
      const tag = await resolveTag(ctx, name);
      if (isError(tag)) return tag;
      if (!tag) {
        notFound.push(name);
        continue;
      }
      if (!had.has(tag.id)) {
        notCarried.push(tag.name);
        continue;
      }
      const unlinked = await recordTagService.unlinkPair(asMember(ctx), tag.id, args.recordId);
      if (isError(unlinked)) return unlinked;
      had.delete(tag.id);
      removed.push(tag.name);
    }

    const lines = [
      removed.length ? `Took ${list(removed)} off ${record.title}.` : `Nothing taken off ${record.title}.`,
      ...(notCarried.length ? [`It didn't carry ${list(notCarried)}.`] : []),
      ...(notFound.length ? [`The group has no tag named ${list(notFound)}; list_tags lists them.`] : []),
      record.url,
    ];
    return {
      text: lines.join("\n"),
      structured: {
        target: args.target,
        recordId: args.recordId,
        title: record.title,
        removed: [...removed].sort(byTagName),
        notCarried: [...notCarried].sort(byTagName),
        notFound: [...notFound].sort(byTagName),
        url: record.url,
      },
    };
  },
});
