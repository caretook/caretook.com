import { AdminCard } from "../AdminCard";
import type { Route } from "./+types/route";
import type { AdminActionResult } from "../adminForms";

import { ATTESTATION_TEXT } from "@caretook/data/schema";
import { Form, useNavigation } from "react-router";
import { requireStaff } from "~/.server/admin";
import { CheckField, Field, FormFooter, Message, Notice } from "~/components/ui";
import { formString } from "~/lib/core/form";
import { adminFailure, issueFor } from "../adminForms";

// /admin/new-group: staff set up a care group for a family by hand. The
// group and its care recipient are created with no members, and its owner
// gets an emailed invitation (`ownerInvite`). The staff member doesn't join:
// they never see the group's care data.

export const meta = () => [{ title: "New group · Caretook admin" }, { name: "robots", content: "noindex" }];

export async function loader({ request }: Route.LoaderArgs) {
  await requireStaff(request);
  return null;
}

export async function action({ request }: Route.ActionArgs): Promise<AdminActionResult> {
  const { api } = await requireStaff(request);
  const form = await request.formData();
  const field = (name: string) => formString(form, name).trim();
  if (form.get("attested") !== "on")
    return { ok: false, error: "", issues: [{ path: "attested", message: "Confirm this first." }] };
  try {
    const created = await api.admin.careGroup.createWithOwnerInvite({
      groupName: field("groupName"),
      recipientName: field("recipientName"),
      ownerEmail: field("ownerEmail"),
      timeZone: field("timeZone") || null,
      attested: true,
    });
    return {
      ok: true,
      message: `Created ${created.groupName}. An invitation is on its way to ${created.ownerEmail}.`,
    };
  } catch (e) {
    return adminFailure(e);
  }
}

export default function NewGroup({ actionData }: Route.ComponentProps) {
  const busy = useNavigation().state !== "idle";
  return (
    <AdminCard id="new-group" level={1} title="New care group">
      <Form
        method="post"
        className="flex flex-col gap-1"
        data-admin-form="newGroup"
        key={actionData?.ok ? "done" : "form"}
        onSubmit={(event) => {
          const zone = event.currentTarget.elements.namedItem("timeZone");
          if (zone instanceof HTMLInputElement) zone.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
        }}
      >
        <p className="text-muted text-sm">
          For a family set up by hand. Its owner gets an email invitation; you won't be a member.
        </p>
        {/* The action runs on the server, so the recipient's zone is this browser's, filled in on submit. */}
        <input type="hidden" name="timeZone" defaultValue="" />
        <Field kind="input" label="Group name" error={issueFor(actionData, "groupName")}>
          {(control) => <input {...control} name="groupName" maxLength={120} required />}
        </Field>
        <Field kind="input" label="Care recipient's name" error={issueFor(actionData, "recipientName")}>
          {(control) => <input {...control} name="recipientName" maxLength={120} required />}
        </Field>
        <Field kind="input" label="Owner's email" error={issueFor(actionData, "ownerEmail")}>
          {(control) => <input {...control} name="ownerEmail" type="email" autoComplete="off" required />}
        </Field>
        <CheckField
          label={ATTESTATION_TEXT}
          name="attested"
          required
          error={issueFor(actionData, "attested")}
          className="py-2 text-sm"
        />
        {actionData && !actionData.ok && actionData.error && (
          <Message tone="error">{actionData.error}</Message>
        )}
        {actionData?.ok && <Notice tone="success">{actionData.message}</Notice>}
        <FormFooter
          align="start"
          submitLabel="Create group and invite owner"
          busy={busy}
          busyLabel="Creating…"
        />
      </Form>
    </AdminCard>
  );
}
