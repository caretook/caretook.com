import type { Route } from "./+types/route";
import type { AdminActionResult } from "../adminForms";

import { requireStaff } from "~/.server/admin";
import { clearSuppressionAction, loadSuppressions } from "./suppressionsData";
import { SuppressionsPage } from "./SuppressionsPage";

// /admin/suppressions (hosting PRD, slice 4): addresses suppressed after a
// hard bounce or a complaint (Resend's webhook). Every staff member may list
// them (`users.read`); clearing one needs `users.help` and a reason, and is
// audited (`mail.suppressionCleared`).

export const meta = () => [
  { title: "Suppressions · Caretook admin" },
  { name: "robots", content: "noindex" },
];

export async function loader({ request }: Route.LoaderArgs) {
  const { api, capabilities } = await requireStaff(request, "users.read");
  return loadSuppressions(new URL(request.url), api.admin.suppressions, capabilities);
}

export async function action({ request }: Route.ActionArgs): Promise<AdminActionResult> {
  const { api } = await requireStaff(request, "users.help");
  return clearSuppressionAction(await request.formData(), api.admin.suppressions);
}

export default function Suppressions({ loaderData }: Route.ComponentProps) {
  return <SuppressionsPage data={loaderData} />;
}
