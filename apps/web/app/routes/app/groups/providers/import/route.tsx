import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ProviderRow } from "~/lib/providers/providers.sync";
import type { GroupRow } from "~/lib/timeline/timeline.sync";

import { useState } from "react";
import { redirect } from "react-router";
import { formString } from "~/lib/core/form";
import { getGroup } from "~/lib/app-shell/group";
import { sessionContext } from "~/lib/auth/session";
import { IMPORT_TITLE } from "~/lib/providers/importWording";
import { importProviders, providersQuery, toProviders } from "~/lib/providers/providers.sync";
import { groupFor, myGroupsQuery, readRows, toMyGroup } from "~/lib/timeline/timeline.sync";
import { Button, ChoiceGroup, Sheet } from "~/components/ui";
import { useCloseProviderSheet, useProvidersOutlet } from "../providerSheet";
import { importProvidersGuard } from "../providerSheetGuard";
import { ImportList } from "./ImportList";

// Shared by web + native. `providers/import`: copy providers from another of
// the user's groups into this one, over the directory. Pick the group, then
// tick providers (the directory's search and type chips); ones already here
// are disabled. The copies are local creates that upload later
// (`importProviders`). A viewer, or a writer in no other group, lands on the list.

export async function clientLoader({ request, context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const mine = await readRows<GroupRow>(db, myGroupsQuery(db.userId));
  const decision = importProvidersGuard({
    groupId: group.id,
    search: new URL(request.url).search,
    canWrite: group.canWrite,
    groups: mine.map(toMyGroup),
  });
  if ("redirect" in decision) throw redirect(decision.redirect);
  const groups = await Promise.all(
    decision.sheet.map(async (g) => ({
      id: g.id,
      name: g.recipient?.displayName || g.name,
      // Deleted ones too: a clinician's deleted practice isn't copied.
      rows: await readRows<ProviderRow>(db, providersQuery(g.id, { includeDeleted: true })),
    })),
  );
  return { groups };
}

/** A local write; the list's live query shows the copies, and PowerSync uploads them. */
export async function clientAction({ request, context }: Route.ClientActionArgs) {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const form = await request.formData();
  const from = formString(form, "from");
  if (!from || from === group.id || !(await groupFor(db, from)))
    return { ok: false as const, error: "That group isn't on this device.", issues: [] };
  const source = toProviders(await readRows<ProviderRow>(db, providersQuery(from, { includeDeleted: true })));
  return importProviders(db, group.id, source, form.getAll("id").map(String));
}

/** The source lists are live, so an import doesn't rerun the loader. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  return defaultShouldRevalidate;
}

export default function ImportProvidersSheet({ loaderData }: Route.ComponentProps) {
  const { groups } = loaderData;
  const { providers } = useProvidersOutlet();
  const close = useCloseProviderSheet();
  // With one other group there's nothing to choose.
  const [from, setFrom] = useState(groups.length === 1 ? groups[0]!.id : "");
  const source = groups.find((g) => g.id === from);
  return (
    // Only the ticks are work to lose: searching or choosing a group isn't.
    <Sheet
      guardChanges="[data-import-picks]"
      isOpen
      onOpenChange={(open) => !open && close()}
      title={IMPORT_TITLE}
    >
      <div className="space-y-4" data-import-sheet>
        <ChoiceGroup
          name="from"
          label="Import from"
          options={groups.map((g) => ({ value: g.id, label: g.name }))}
          value={from}
          onChange={setFrom}
        />
        {source ? (
          <ImportList key={source.id} group={source} target={providers} onDone={close} />
        ) : (
          <div className="flex justify-end">
            <Button onClick={close}>Cancel</Button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
