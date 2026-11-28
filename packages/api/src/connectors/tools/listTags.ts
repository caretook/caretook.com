import { isError, tagService } from "@caretook/data";
import { z } from "zod";
import { defineTool, READ_ANNOTATIONS } from "../registry";
import { asMember } from "./shared";
import { byTagName, liveUses, useCounts } from "./tagSupport";

/** The group's tags, A to Z, each with how many live records carry it. */
export const listTags = defineTool({
  name: "list_tags",
  title: "List tags",
  description:
    "The care group's tags, A to Z, each with its id and how many live items carry it (in all and by kind: entry, todo, provider, medication). Give a tag's name or id to tagged_items to see what carries it.",
  scope: "read",
  input: z.object({}),
  annotations: READ_ANNOTATIONS,
  handler: async (_args, ctx) => {
    const found = await tagService.list(asMember(ctx), { groupId: ctx.groupId });
    if (isError(found)) return found;
    const live = await liveUses(ctx);
    if (isError(live)) return live;

    const tags = [...found.data]
      .sort((a, b) => byTagName(a.name, b.name) || a.id.localeCompare(b.id))
      .map((t) => ({ id: t.id, name: t.name, ...useCounts(live.uses.get(t.id)) }));

    const text = tags.length
      ? [
          `${tags.length} tag${tags.length === 1 ? "" : "s"}:`,
          ...tags.map((t) => `- ${t.name} (${t.items} item${t.items === 1 ? "" : "s"})`),
        ].join("\n")
      : "No tags yet.";
    return { text, structured: { tags } };
  },
});
