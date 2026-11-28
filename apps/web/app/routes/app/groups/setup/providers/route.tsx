import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { CreateResult } from "~/lib/core/api";
import type { ProviderRow } from "~/lib/providers/providers.sync";

import { isPracticeType } from "@caretook/data/schema";
import { useCallback, useId, useMemo, useState } from "react";
import { ProviderForm, ProviderListItem } from "~/components/providers";
import { Card, List, TITLE_SUB } from "~/components/ui";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { sessionContext } from "~/lib/auth/session";
import { issuesForRows, providerFromForm } from "~/lib/providers/providerFormData";
import { createProvider, providersQuery, toProviders } from "~/lib/providers/providers.sync";
import { useLiveQuery } from "~/lib/sync";
import { readRows } from "~/lib/timeline/timeline.sync";

// Shared by web + native. The setup flow's providers step: the provider form
// on the page, posting here, written on the device as the directory's add
// sheet writes it (offline too), then a fresh form; below it, what's added,
// live, as the directory lists it.

export async function clientLoader({ context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  return { rows: await readRows<ProviderRow>(db, providersQuery(group.id)) };
}

export async function clientAction({ request, context }: Route.ClientActionArgs): Promise<CreateResult> {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const { input, phoneRows } = providerFromForm(await request.formData());
  const result = await createProvider(db, group.id, input);
  if (!result.ok) return { ...result, issues: issuesForRows(result.issues, phoneRows) };
  return { ok: true, id: result.id };
}

/** The list is live, so a save needn't reload it. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  return defaultShouldRevalidate;
}

export default function SetupProviders({ loaderData }: Route.ComponentProps) {
  const { id: groupId } = useGroup();
  const query = providersQuery(groupId);
  const rows = useLiveQuery<ProviderRow>(query.sql, query.params, loaderData.rows);
  const providers = useMemo(() => toProviders(rows), [rows]);
  const practices = useMemo(() => providers.filter((p) => isPracticeType(p.type)), [providers]);
  const practiceNames = useMemo(() => new Map(providers.map((p) => [p.id, p.name])), [providers]);
  // Each save starts a new, empty form.
  const [formKey, setFormKey] = useState(0);
  const added = useCallback(() => setFormKey((k) => k + 1), []);
  const addedId = useId();
  return (
    <>
      <Card title="Add a provider">
        <ProviderForm key={formKey} practices={practices} onDone={added} />
      </Card>
      {providers.length > 0 && (
        <section aria-labelledby={addedId} className="space-y-2" data-setup-added="">
          <h2 id={addedId} className={TITLE_SUB}>
            Added
          </h2>
          <List label="Added providers">
            {providers.map((p) => (
              <ProviderListItem
                key={p.id}
                provider={p}
                practiceName={p.practiceId ? (practiceNames.get(p.practiceId) ?? null) : null}
                condensed
              />
            ))}
          </List>
        </section>
      )}
    </>
  );
}
