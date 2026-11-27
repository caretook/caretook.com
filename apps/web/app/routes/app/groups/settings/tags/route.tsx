import type { Route } from "./+types/route";
import type { TagRow, TagUseRow } from "~/lib/tags/tags.sync";

import { SettingsCard, SettingsPage } from "~/components/settings";
import { useGroupTags, useGroupTagUses } from "~/components/tags";
import { EmptyState, List } from "~/components/ui";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { sessionContext } from "~/lib/auth/session";
import { groupTagUsesQuery, tagsQuery } from "~/lib/tags/tags.sync";
import { readRows } from "~/lib/timeline/timeline.sync";
import { TagSettingsRow } from "./TagSettingsRow";

// `…/settings/tags` (tags-3 slice 2). Shared by web + native. The group's
// one tag list, A to Z, from the device's copy (live, so it follows another
// device's change), each with how many live records carry it (one counts
// query for the list). Rename, Color and Delete are local writes like the
// picker's, so they work offline; who sees each is the tag rules'
// (`canRenameTag`, `canDeleteTag`), and the writes check again.

export const meta = () => [{ title: "Tags · Group settings · Caretook" }];

export async function clientLoader({ params, context }: Route.ClientLoaderArgs) {
  const { groupId } = params;
  getGroup(context);
  const { db } = context.get(sessionContext);
  const [tags, uses] = await Promise.all([
    readRows<TagRow>(db, tagsQuery(groupId)),
    readRows<TagUseRow>(db, groupTagUsesQuery(groupId)),
  ]);
  return { tags, uses };
}

export default function GroupTags({ loaderData }: Route.ComponentProps) {
  const group = useGroup();
  const tags = useGroupTags(group.id, loaderData.tags);
  const uses = useGroupTagUses(group.id, loaderData.uses);

  return (
    <SettingsPage title="Tags">
      <SettingsCard id="tags">
        <p className="text-muted text-sm">
          The care group&rsquo;s one list of tags, shared by everyone in it. Tags go on timeline entries,
          to-dos, providers and medications.
        </p>
        {tags.length ? (
          <List label="The group's tags" data-tag-list="">
            {tags.map((t) => (
              <TagSettingsRow
                key={t.id}
                tag={t}
                uses={uses.get(t.id) ?? 0}
                role={group.role}
                userId={group.userId}
              />
            ))}
          </List>
        ) : (
          <EmptyState data-tags-empty="">No tags yet. Add one from any record&rsquo;s Add tag.</EmptyState>
        )}
      </SettingsCard>
    </SettingsPage>
  );
}
