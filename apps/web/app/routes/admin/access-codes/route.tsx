import type { Route } from "./+types/route";
import type { AdminActionResult } from "../adminForms";

import { Form, Link, useNavigation } from "react-router";
import { requireStaff } from "~/.server/admin";
import { Field } from "~/components/ui";
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
      <section className="card bg-base-100 shadow-sm" aria-labelledby="new-code">
        <Form method="post" className="card-body gap-1" data-admin-form="newCode">
          <h1 id="new-code" className="card-title">
            New access code
          </h1>
          <p className="text-base-content/70 text-sm">
            Someone with the code creates an account and their own care group, as its owner.
          </p>
          <input type="hidden" name="intent" value="create" />
          <div className="grid gap-x-4 sm:grid-cols-3">
            <Field label="Label" help="Where it's handed out." error={issueFor(actionData, "label")}>
              {(control) => (
                <input {...control} name="label" className="input w-full" maxLength={100} required />
              )}
            </Field>
            <Field label="Expires in (days)" error={issueFor(actionData, "expiresInDays")}>
              {(control) => (
                <input
                  {...control}
                  name="expiresInDays"
                  type="number"
                  min={1}
                  max={730}
                  defaultValue={90}
                  className="input w-full"
                  required
                />
              )}
            </Field>
            <Field label="Maximum uses" help="Empty: no limit." error={issueFor(actionData, "maxUses")}>
              {(control) => (
                <input {...control} name="maxUses" type="number" min={1} className="input w-full" />
              )}
            </Field>
          </div>
          {actionData && !actionData.ok && !actionData.issues.length && (
            <p role="alert" className="text-error text-sm">
              {actionData.error}
            </p>
          )}
          {actionData?.ok && (
            <p role="status" className="alert alert-success alert-soft text-sm">
              {actionData.message}
            </p>
          )}
          <button type="submit" className="btn btn-primary mt-2 w-fit" disabled={busy}>
            Create code
          </button>
        </Form>
      </section>

      <section className="card bg-base-100 shadow-sm" aria-labelledby="codes">
        <div className="card-body">
          <h2 id="codes" className="card-title">
            Access codes
          </h2>
          {loaderData.codes.length === 0 ? (
            <p className="text-sm">No codes yet.</p>
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
                        <Link to={adminUrls.printAccessCode(c.id)} className="btn btn-sm">
                          Print<span className="sr-only"> {c.code}</span>
                        </Link>
                        {c.state !== "revoked" && (
                          <Form method="post">
                            <input type="hidden" name="intent" value="revoke" />
                            <input type="hidden" name="id" value={c.id} />
                            <button type="submit" className="btn btn-sm btn-ghost text-error" disabled={busy}>
                              Revoke<span className="sr-only"> {c.code}</span>
                            </button>
                          </Form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
