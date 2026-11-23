import { AdminCard } from "../AdminCard";
import type { Route } from "./+types/route";
import type { AdminActionResult } from "../adminForms";

import { Form, useNavigation } from "react-router";
import { requireStaff } from "~/.server/admin";
import { Button, EmptyState, Field, FormFooter, Message, Notice } from "~/components/ui";
import { formString } from "~/lib/core/form";
import { adminFailure, issueFor } from "../adminForms";
import { adminUrls } from "../adminUrls";

// /admin/access-codes: every code with its uses, a form for a new one, and
// Revoke. A code lets someone create an account and start their own care
// group at /join/<code>; Print shows its QR code for a flyer.

export const meta = () => [
  { title: "Access codes · Caretook admin" },
  { name: "robots", content: "noindex" },
];

export async function loader({ request }: Route.LoaderArgs) {
  const { api } = await requireStaff(request);
  return { codes: await api.admin.accessCode.list() };
}

export async function action({ request }: Route.ActionArgs): Promise<AdminActionResult> {
  const { api } = await requireStaff(request);
  const form = await request.formData();
  const field = (name: string) => formString(form, name).trim();
  try {
    if (field("intent") === "revoke") {
      const revoked = await api.admin.accessCode.revoke({ id: field("id") });
      return { ok: true, message: `${revoked.code} is revoked.` };
    }
    const created = await api.admin.accessCode.create({
      label: field("label"),
      expiresInDays: Number(field("expiresInDays")),
      ...(field("maxUses") ? { maxUses: Number(field("maxUses")) } : {}),
    });
    return { ok: true, message: `Created ${created.code}.` };
  } catch (e) {
    return adminFailure(e);
  }
}

const STATE_LABELS: Record<string, string> = {
  usable: "Active",
  expired: "Expired",
  revoked: "Revoked",
  usedUp: "Used up",
};

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });

export default function AccessCodes({ loaderData, actionData }: Route.ComponentProps) {
  const busy = useNavigation().state !== "idle";
  return (
    <>
      <AdminCard id="new-code" level={1} title="New access code">
        <Form method="post" className="flex flex-col gap-1" data-admin-form="newCode">
          <p className="text-muted text-sm">
            Someone with the code creates an account and their own care group, as its owner.
          </p>
          <input type="hidden" name="intent" value="create" />
          <div className="grid gap-x-4 sm:grid-cols-3">
            <Field
              kind="input"
              label="Label"
              help="Where it's handed out."
              error={issueFor(actionData, "label")}
            >
              {(control) => <input {...control} name="label" maxLength={100} required />}
            </Field>
            <Field kind="input" label="Expires in (days)" error={issueFor(actionData, "expiresInDays")}>
              {(control) => (
                <input
                  {...control}
                  name="expiresInDays"
                  type="number"
                  min={1}
                  max={730}
                  defaultValue={90}
                  required
                />
              )}
            </Field>
            <Field
              kind="input"
              label="Maximum uses"
              help="Empty: no limit."
              error={issueFor(actionData, "maxUses")}
            >
              {(control) => <input {...control} name="maxUses" type="number" min={1} />}
            </Field>
          </div>
          {actionData && !actionData.ok && !actionData.issues.length && (
            <Message tone="error">{actionData.error}</Message>
          )}
          {actionData?.ok && <Notice tone="success">{actionData.message}</Notice>}
          <FormFooter align="start" submitLabel="Create code" busy={busy} />
        </Form>
      </AdminCard>

      <AdminCard id="codes" title="Access codes">
        {loaderData.codes.length === 0 ? (
          <EmptyState>No codes yet.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="table" data-access-codes="">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Label</th>
                  <th>Uses</th>
                  <th>Expires</th>
                  <th>State</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loaderData.codes.map((c) => (
                  <tr key={c.id} data-code={c.code} data-state={c.state}>
                    <td className="font-mono whitespace-nowrap">{c.code}</td>
                    <td>{c.label}</td>
                    <td>
                      {c.useCount}
                      {c.maxUses != null && ` of ${c.maxUses}`}
                    </td>
                    <td className="whitespace-nowrap">{day(c.expiresAt)}</td>
                    <td>{STATE_LABELS[c.state] ?? c.state}</td>
                    <td className="flex justify-end gap-2">
                      <Button to={adminUrls.printAccessCode(c.id)} size="sm">
                        Print<span className="sr-only"> {c.code}</span>
                      </Button>
                      {c.state !== "revoked" && (
                        <Form method="post">
                          <input type="hidden" name="intent" value="revoke" />
                          <input type="hidden" name="id" value={c.id} />
                          <Button type="submit" size="sm" variant="dangerQuiet" disabled={busy}>
                            Revoke<span className="sr-only"> {c.code}</span>
                          </Button>
                        </Form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>
    </>
  );
}
