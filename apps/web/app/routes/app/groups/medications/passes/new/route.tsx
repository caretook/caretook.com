import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/core/api";
import type { PassRow } from "~/lib/medications/medicationPasses.sync";

import { canAddPass } from "@caretook/data/schema";
import { useCallback, useRef } from "react";
import { redirect, useLocation, useNavigate } from "react-router";
import { Sheet } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { getGroup } from "~/lib/app-shell/group";
import { sessionContext } from "~/lib/auth/session";
import { createPass, passesQuery, toPasses } from "~/lib/medications/medicationPasses.sync";
import { newPassGuard, openedFromPasses } from "~/lib/medications/medicationSheets";
import { readRows } from "~/lib/timeline/timeline.sync";
import { passActionFromForm } from "../passActions";
import { PassForm } from "../PassForm";
import { usePassZoneNote } from "../usePasses";

// Shared by web + native. `medications/passes/new`: the add-pass sheet, over
// the Passes tab, opened from the header's `+` on any tab. A viewer, or a
// group that already has its 8 passes, lands on the tab.

export async function clientLoader({ context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const passes = toPasses(await readRows<PassRow>(db, passesQuery(group.id)));
  const decision = newPassGuard({ groupId: group.id, canWrite: group.canWrite, canAdd: canAddPass(passes) });
  if ("redirect" in decision) throw redirect(decision.redirect);
  return null;
}

/** A local write; the tab's live queries show the new pass, and PowerSync uploads it. */
export async function clientAction({ request, context }: Route.ClientActionArgs): Promise<ActionResult> {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const action = passActionFromForm(await request.formData());
  if (action?.intent !== "create") return { ok: false, error: "Nothing to do", issues: [] };
  return createPass(db, group.id, { name: action.name, time: action.time });
}

/** The sheet closes on a save, so its own loader needn't run again. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  return defaultShouldRevalidate;
}

/**
 * Close by leaving the route: back, when the Passes tab opened it;
 * otherwise (another tab, a bookmark, a reload) the Passes tab replaces it,
 * so a new pass shows in its list. Only the first call counts.
 */
function useClosePassSheet(groupId: string) {
  const navigate = useNavigate();
  const state: unknown = useLocation().state;
  const closed = useRef(false);
  return useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    if (openedFromPasses(state)) void navigate(-1);
    else void navigate(appUrls.medicationPasses(groupId), { replace: true, preventScrollReset: true });
  }, [navigate, state, groupId]);
}

export default function NewPassSheet({ params }: Route.ComponentProps) {
  const close = useClosePassSheet(params.groupId);
  const zoneNote = usePassZoneNote();
  return (
    <Sheet guardChanges isOpen onOpenChange={(open) => !open && close()} title="Add a med time">
      <PassForm zoneNote={zoneNote} onDone={close} onCancel={close} />
    </Sheet>
  );
}
