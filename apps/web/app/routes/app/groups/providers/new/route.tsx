import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { CreateResult } from "~/lib/core/api";

import { useCallback, useMemo, useState } from "react";
import { redirect, useLocation, useNavigate } from "react-router";
import { isPracticeType } from "@caretook/data/schema";
import { appUrls } from "~/lib/app-shell/appUrls";
import { providerDraftFrom } from "~/lib/assistant/quickEntryDraft";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { sessionContext } from "~/lib/auth/session";
import { createProvider } from "~/lib/providers/providers.sync";
import { Sheet } from "~/components/ui";
import { ProviderForm } from "../ProviderForm";
import { issuesForRows, providerFromForm } from "../providerFormData";
import { useCloseProviderSheet, useProvidersOutlet } from "../providerSheet";
import { newProviderGuard } from "../providerSheetGuard";

// Shared by web + native. `providers/new` (`?type=pharmacy` starts as that
// type): the add sheet, over the directory. A viewer lands on the list. A
// save opens the new provider's page in the sheet's place, so Back goes to
// the directory, not the form; Cancel, Escape and a tap outside close as any
// provider sheet does.

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

/** A local write, so the provider's page finds it at once; PowerSync uploads it. */
export async function clientAction({ request, context }: Route.ClientActionArgs): Promise<CreateResult> {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const { input, phoneRows } = providerFromForm(await request.formData());
  const result = await createProvider(db, group.id, input);
  if (!result.ok) return { ...result, issues: issuesForRows(result.issues, phoneRows) };
  return { ok: true, id: result.id };
}

/** The sheet leaves on a save, so its own loader needn't run again. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  return defaultShouldRevalidate;
}

export default function NewProviderSheet({ loaderData }: Route.ComponentProps) {
  const { providers } = useProvidersOutlet();
  const close = useCloseProviderSheet();
  const navigate = useNavigate();
  const { id: groupId } = useGroup();
  const location = useLocation();
  const { search } = location;
  // Opened from quick entry ("add provider Dr Kim cardiology 555-0100"): the form starts filled in.
  const [draft] = useState(() => providerDraftFrom(location.state as unknown));
  const opened = useCallback(
    (id?: string) => (id ? void navigate(appUrls.provider(groupId, id), { replace: true }) : close()),
    [navigate, groupId, close],
  );
  const practices = useMemo(() => providers.filter((p) => isPracticeType(p.type)), [providers]);
  return (
    <Sheet guardChanges isOpen onOpenChange={(open) => !open && close()} title="Add a provider">
      <ProviderForm
        // A new URL is a new form.
        key={search}
        initialType={draft?.type ?? loaderData.type}
        draft={draft}
        practices={practices}
        onDone={opened}
        onCancel={close}
      />
    </Sheet>
  );
}
