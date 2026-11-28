import type { TagTarget } from "@caretook/data";
import type { ToolContext } from "../registry";

import {
  isError,
  medicationService,
  providerService,
  recordTagService,
  TAG_TARGETS,
  tagService,
  targetOf,
  timelineEntryModel,
  todoService,
} from "@caretook/data";
import { z } from "zod";
import { asMember, eq } from "./shared";

// What the tag tools share (connectors-5): resolving a tag the assistant
// names, each record's tag names, and the live records carrying each tag.
// Every read is the member's, in the grant's group, so the services' SQL
// scope decides. Later slices import this module and never edit it.

/** Tag names in the app's order: A to Z, case aside. */
export const byTagName = (a: string, b: string) =>
  a.localeCompare(b, undefined, { sensitivity: "base" }) || a.localeCompare(b);

const isId = (value: string) => z.uuid().safeParse(value).success;

/**
 * The group's tag that `nameOrId` names: an id from `list_tags`, or a name
 * in any case or spacing (folded through `tagKey`, by `tagService.getByName`).
 * Null when the group has none.
 */
export const resolveTag = async (ctx: ToolContext, nameOrId: string) => {
  const wanted = nameOrId.trim();
  if (!wanted) return null;
  if (isId(wanted)) {
    const tag = await tagService.getById(asMember(ctx), wanted);
    if (isError(tag)) return tag;
    if (tag) return tag.groupId === ctx.groupId ? tag : null;
  }
  return tagService.getByName(asMember(ctx), ctx.groupId, wanted);
};

/**
 * Each record's tag names, A to Z: one read of the group's links and one of
 * its tags. Keyed by record id (ids are unique across kinds); a record
 * without tags isn't in the map (`tagsOf` answers []).
 */
export const tagsByRecord = async (ctx: ToolContext) => {
  const links = await recordTagService.listForGroup(asMember(ctx), ctx.groupId);
  if (isError(links)) return links;
  const tags = await tagService.list(asMember(ctx), { groupId: ctx.groupId });
  if (isError(tags)) return tags;
  const names = new Map(tags.data.map((t) => [t.id, t.name]));
  const byRecord = new Map<string, string[]>();
  for (const link of links.data) {
    const found = targetOf(link);
    const name = names.get(link.tagId);
    if (!found || !name) continue;
    const list = byRecord.get(found.recordId) ?? [];
    list.push(name);
    byRecord.set(found.recordId, list);
  }
  for (const list of byRecord.values()) list.sort(byTagName);
  return byRecord as ReadonlyMap<string, readonly string[]>;
};

/** A record's tag names from `tagsByRecord`, A to Z ([] when none). */
export const tagsOf = (byRecord: ReadonlyMap<string, readonly string[]>, recordId: string) => [
  ...(byRecord.get(recordId) ?? []),
];

/** The end of a record's text line: its tags, when it has any ("" otherwise). */
export const tagsSuffix = (names: readonly string[]) => (names.length ? ` · tags: ${names.join(", ")}` : "");

/** How many ids go in one `inArray` read. */
const IDS_PER_READ = 500;

/**
 * The live entries among `ids`, as the member: the timeline service only
 * pages the whole timeline by time, so this reads the model by id (its SQL
 * scope is the same; soft-deleted entries are left out).
 */
const liveEntries = async (ctx: ToolContext, ids: readonly string[]) => {
  const rows: Extract<Awaited<ReturnType<typeof timelineEntryModel.list>>, { data: unknown }>["data"] = [];
  for (let at = 0; at < ids.length; at += IDS_PER_READ) {
    const res = await timelineEntryModel.list({
      ...asMember(ctx),
      filter: {
        groupId: eq(ctx.groupId),
        id: { type: "inArray", value: ids.slice(at, at + IDS_PER_READ) },
      },
    });
    if (isError(res)) return res;
    rows.push(...res.data);
  }
  return rows;
};

/** `rows` keyed by id, only those in `ids`. */
const keep = <T extends { id: string }>(rows: readonly T[], ids: ReadonlySet<string>) =>
  new Map(rows.filter((r) => ids.has(r.id)).map((r) => [r.id, r]));

/** Each kind's linked record ids, live ones only. */
export type TagUses = Record<TagTarget, string[]>;

const noUses = (): TagUses => ({ entry: [], todo: [], provider: [], medication: [] });

/**
 * The live records carrying each tag, by kind. One read of the group's
 * links, then one list per kind that has links (never a read per link);
 * soft-deleted records keep their links but are never counted or listed.
 * `records` holds the live linked records; `uses` maps a tag id to its
 * records' ids by kind (a tag carried by nothing live isn't in it).
 */
export const liveUses = async (ctx: ToolContext) => {
  const links = await recordTagService.listForGroup(asMember(ctx), ctx.groupId);
  if (isError(links)) return links;
  const linked: Record<TagTarget, Set<string>> = {
    entry: new Set(),
    todo: new Set(),
    provider: new Set(),
    medication: new Set(),
  };
  for (const link of links.data) {
    const found = targetOf(link);
    if (found) linked[found.target].add(found.recordId);
  }

  const entries = linked.entry.size ? await liveEntries(ctx, [...linked.entry]) : [];
  if (isError(entries)) return entries;
  const todos = linked.todo.size ? await todoService.list(asMember(ctx), { groupId: ctx.groupId }) : null;
  if (isError(todos)) return todos;
  const providers = linked.provider.size
    ? await providerService.list(asMember(ctx), { groupId: ctx.groupId })
    : null;
  if (isError(providers)) return providers;
  const medications = linked.medication.size
    ? await medicationService.list(asMember(ctx), { groupId: ctx.groupId })
    : null;
  if (isError(medications)) return medications;

  const records = {
    entry: keep(entries, linked.entry),
    todo: keep(todos?.data ?? [], linked.todo),
    provider: keep(providers?.data ?? [], linked.provider),
    medication: keep(medications?.data ?? [], linked.medication),
  };
  const uses = new Map<string, TagUses>();
  for (const link of links.data) {
    const found = targetOf(link);
    if (!found || !records[found.target].has(found.recordId)) continue;
    const of = uses.get(link.tagId) ?? noUses();
    of[found.target].push(found.recordId);
    uses.set(link.tagId, of);
  }
  return { records, uses };
};

/** How many live records carry a tag, in all and by kind. */
export const useCounts = (uses: TagUses | undefined) => {
  const byKind = Object.fromEntries(TAG_TARGETS.map((k) => [k, uses?.[k].length ?? 0])) as Record<
    TagTarget,
    number
  >;
  return { items: TAG_TARGETS.reduce((n, k) => n + byKind[k], 0), byKind };
};
