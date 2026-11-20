import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/api";

import { useMemo } from "react";
import { redirect, useLocation } from "react-router";
import { isPracticeType } from "@caretook/data/schema";
import { getGroup } from "~/lib/group";
import { sessionContext } from "~/lib/session";
import { createProvider } from "~/lib/sync/providers";
import { Sheet } from "~/components/ui";
import { ProviderForm } from "../ProviderForm";
import { issuesForRows, providerFromForm } from "../providerFormData";
import { useCloseProviderSheet, useProvidersOutlet } from "../providerSheet";
import { newProviderGuard } from "../providerSheetGuard";

// Shared by web + native. `providers/new` (`?type=pharmacy` starts as that
// type): the add sheet, over the directory. A viewer lands on the list.

export function clientLoader({ request, context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const decision = newProviderGuard({
    groupId: group.id,
    search: new URL(request.url).search,
    canWrite: group.canWrite,
  });
  if ("redirect" in decision) throw redirect(decision.redirect);
  return decision.sheet;
}

/** A local write; the list's live query shows it, and PowerSync uploads it. */
export async function clientAction({ request, context }: Route.ClientActionArgs): Promise<ActionResult> {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const { input, phoneRows } = providerFromForm(await request.formData());
  const result = await createProvider(db, group.id, input);
  if (!result.ok) return { ...result, issues: issuesForRows(result.issues, phoneRows) };
  return { ok: true };
}

/** The sheet closes on a save, so its own loader needn't run again. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  return defaultShouldRevalidate;
}

export default function NewProviderSheet({ loaderData }: Route.ComponentProps) {
  const { providers } = useProvidersOutlet();
  const close = useCloseProviderSheet();
  const { search } = useLocation();
  const practices = useMemo(() => providers.filter((p) => isPracticeType(p.type)), [providers]);
  return (
    <Sheet isOpen onOpenChange={(open) => !open && close()} title="Add a provider">
      <ProviderForm
        // A new URL is a new form.
        key={search}
        initialType={loaderData.type}
        practices={practices}
        onDone={close}
        onCancel={close}
      />
    </Sheet>
  );
}
