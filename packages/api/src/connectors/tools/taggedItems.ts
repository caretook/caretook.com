import type { TagTarget } from "@caretook/data";

import {
  isDoseDetails,
  isError,
  isSymptomDetails,
  medicationService,
  medicationTitle,
  TAG_TARGETS,
} from "@caretook/data";
import { z } from "zod";
import { linkTo, entryPath, medicationPath, providerPath, todoPath } from "../links";
import { defineTool, READ_ANNOTATIONS } from "../registry";
import { zonedIso } from "../time";
import { LIST_PAGE_MAX, pageOf, pagingInput } from "./readSupport";
import { asMember, loadGroup } from "./shared";
import { liveUses, resolveTag, tagsByRecord, tagsOf, tagsSuffix } from "./tagSupport";
import { doneOrder, todoOrder, todoState } from "@caretook/data/domain";

const input = z.object({
  tag: z.string().trim().min(1).max(200).describe("The tag: its name (any case) or its id from list_tags."),
  kinds: z
    .array(z.enum(TAG_TARGETS))
    .optional()
    .describe(
      "Only these kinds: entry (timeline entries and events), todo, provider, medication. Default: all.",
    ),
  ...pagingInput,
});

/** What an entry is called when it has no title. */
const KIND_TITLES: Record<string, string> = {
  note: "Note",
  symptom: "Symptom",
  event: "Event",
  vital: "Vitals",
  dose: "Dose",
  medicationChange: "Medication change",
  conditionChange: "Condition change",
};

/** Every live record carrying one tag, by kind, each with its tags and its link. */
export const taggedItems = defineTool({
  name: "tagged_items",
  title: "List tagged items",
  description: `Everything live that carries a tag: timeline entries and events (newest first), todos (open first, then done), providers and medications (A to Z), in that order. Give the tag's name (any case) or its id from list_tags; kinds narrows it. Each item has its kind, id, title, when (entries) or status, its tags and a link to it in the app. At most ${LIST_PAGE_MAX} a page; pass nextCursor back for more.`,
  scope: "read",
  input,
  annotations: READ_ANNOTATIONS,
  handler: async (args, ctx) => {
    const loaded = await loadGroup(ctx);
    if (isError(loaded)) return loaded;
    const { timeZone } = loaded;
    const tag = await resolveTag(ctx, args.tag);
    if (isError(tag)) return tag;
    if (!tag)
      return {
        text: `No tag named "${args.tag}"; list_tags lists them.`,
        structured: { tagFound: false, tag: null, items: [], nextCursor: null },
      };

    const live = await liveUses(ctx);
    if (isError(live)) return live;
    const byRecord = await tagsByRecord(ctx);
    if (isError(byRecord)) return byRecord;
    const uses = live.uses.get(tag.id);
    const wanted = new Set<TagTarget>(args.kinds?.length ? args.kinds : TAG_TARGETS);
    const idsOf = (kind: TagTarget) => (wanted.has(kind) ? (uses?.[kind] ?? []) : []);
    const recordsOf = <T>(kind: TagTarget, records: ReadonlyMap<string, T>) =>
      idsOf(kind).flatMap((id) => records.get(id) ?? []);

    const entries = recordsOf("entry", live.records.entry).sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime() || a.id.localeCompare(b.id),
    );
    // A dose is called by its medication (deleted ones keep their names).
    const medicationNames = new Map<string, string>();
    if (entries.some((e) => e.kind === "dose")) {
      const meds = await medicationService.list(asMember(ctx), {
        groupId: ctx.groupId,
        includeDeleted: true,
      });
      if (isError(meds)) return meds;
      for (const m of meds.data) medicationNames.set(m.id, medicationTitle(m));
    }
    const todos = recordsOf("todo", live.records.todo);
    const openTodos = todoOrder(
      todos.filter((t) => !t.doneAt),
      ctx.now,
      timeZone,
    );
    const doneTodos = doneOrder(todos.filter((t) => t.doneAt));
    const byName =
      <T extends { id: string }>(name: (r: T) => string) =>
      (a: T, b: T) =>
        name(a).localeCompare(name(b), undefined, { sensitivity: "base" }) || a.id.localeCompare(b.id);
    const providers = recordsOf("provider", live.records.provider).sort(byName((p) => p.name));
    const medications = recordsOf("medication", live.records.medication).sort(
      byName((m) => medicationTitle(m)),
    );

    const entryTitle = (e: (typeof entries)[number]) =>
      e.title?.trim() ||
      (isSymptomDetails(e.details) ? e.details.name : null) ||
      (isDoseDetails(e.details) ? (medicationNames.get(e.details.medicationId) ?? null) : null) ||
      (KIND_TITLES[e.kind] ?? e.kind);
    const url = (path: string) => linkTo(ctx.origin, path);

    const all = [
      ...entries.map((e) => ({
        kind: "entry" as const,
        entryKind: e.kind,
        id: e.id,
        title: entryTitle(e),
        when: zonedIso(e.occurredAt, timeZone),
        tags: tagsOf(byRecord, e.id),
        url: url(entryPath(ctx.groupId, e)),
      })),
      ...[...openTodos, ...doneTodos].map((t) => ({
        kind: "todo" as const,
        id: t.id,
        title: t.title,
        status: todoState(t, ctx.now, timeZone),
        dueOn: t.dueOn,
        tags: tagsOf(byRecord, t.id),
        url: url(todoPath(ctx.groupId, t.id)),
      })),
      ...providers.map((p) => ({
        kind: "provider" as const,
        id: p.id,
        title: p.name,
        status: p.status,
        tags: tagsOf(byRecord, p.id),
        url: url(providerPath(ctx.groupId, p.id)),
      })),
      ...medications.map((m) => ({
        kind: "medication" as const,
        id: m.id,
        title: medicationTitle(m),
        status: m.status,
        tags: tagsOf(byRecord, m.id),
        url: url(medicationPath(ctx.groupId, m.id)),
      })),
    ];
    const page = pageOf(all, args);

    const line = (item: (typeof all)[number]) => {
      const head =
        item.kind === "entry"
          ? `${item.when} ${item.entryKind}: ${item.title}`
          : item.kind === "todo"
            ? `Todo: ${item.title} [${item.status}]${item.dueOn ? ` due ${item.dueOn}` : ""}`
            : `${item.kind === "provider" ? "Provider" : "Medication"}: ${item.title} (${item.status})`;
      return `- ${head}${tagsSuffix(item.tags)}`;
    };
    const text = page.items.length
      ? [
          `${all.length} item${all.length === 1 ? "" : "s"} tagged ${tag.name} (${timeZone}):`,
          ...page.items.map(line),
          ...(page.nextCursor ? ["More: call again with nextCursor."] : []),
        ].join("\n")
      : `Nothing${args.kinds?.length ? ` of those kinds` : ""} carries ${tag.name}.`;
    return {
      text,
      structured: {
        tagFound: true,
        tag: { id: tag.id, name: tag.name },
        timeZone,
        total: all.length,
        items: page.items,
        nextCursor: page.nextCursor,
      },
    };
  },
});
