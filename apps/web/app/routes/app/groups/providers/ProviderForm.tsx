import type { NewProviderDraft, ProviderType } from "@caretook/data/schema";
import type { ActionResult, CreateResult, FieldIssue } from "~/lib/core/api";
import type { LocalProvider } from "~/lib/providers/providers.sync";

import { useEffect, useId, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { PROVIDER_LIMITS, PROVIDER_TYPES } from "@caretook/data/schema";
import { PhoneFields } from "~/components/contact";
import {
  Button,
  CheckField,
  ChoiceGroup,
  Field,
  FormFooter,
  FormTabs,
  Message,
  revealField,
} from "~/components/ui";
import { PROVIDER_TYPE_META } from "~/lib/providers/providerDirectory";
import { SPECIALTY_SUGGESTIONS } from "~/lib/providers/specialties";
import { FIELD, hasPractice } from "./providerFormData";

/** What the specialty field is called, and an example, per type. */
const SPECIALTY: Record<ProviderType, { label: string; placeholder: string }> = {
  clinician: { label: "Specialty", placeholder: "e.g. Cardiology" },
  practice: { label: "Kind of place", placeholder: "e.g. Family medicine clinic" },
  pharmacy: { label: "Kind of pharmacy", placeholder: "e.g. Retail, mail order" },
  other: { label: "Role", placeholder: "e.g. Home health aide" },
};

const NAME_PLACEHOLDER: Record<ProviderType, string> = {
  clinician: "e.g. Dr. Jane Smith",
  practice: "e.g. Westside Family Medicine",
  pharmacy: "e.g. Main Street Pharmacy",
  other: "e.g. Sam (neighbor)",
};

/** A provider phone's label choices (before Custom), from the labels people use. */
const PHONE_LABELS = [
  "Office",
  "Mobile",
  "Front desk",
  "Nurse line",
  "After hours",
  "Refills",
  "Fax",
] as const;

const issueFor = (issues: FieldIssue[], path: string) => issues.find((i) => i.path === path)?.message;

const TYPE_OPTIONS = PROVIDER_TYPES.map((t) => ({ value: t, label: PROVIDER_TYPE_META[t].label }));

/**
 * Add or edit a provider. Posts to its sheet route's clientAction, which
 * writes on the device; the shared Zod schema's messages show on the
 * fields. `practices` are the group's practices and pharmacies a clinician
 * (or another contact) can work at.
 */
export function ProviderForm({
  provider,
  initialType = "clinician",
  practices,
  draft,
  onDone,
  onCancel,
  onDelete,
}: {
  /** Editing this provider; omit to add one. */
  provider?: LocalProvider;
  /** Adding: what the fields start with (quick entry's "add provider Dr Kim cardiology 555-0100"). */
  draft?: Pick<NewProviderDraft, "name" | "specialty" | "practiceId" | "phone" | "address"> | null;
  initialType?: ProviderType;
  practices: LocalProvider[];
  /** After a save; adding one passes the new provider's id. The form itself never navigates. */
  onDone: (id?: string) => void;
  onCancel: () => void;
  /** Editing: asks to delete the provider. */
  onDelete?: () => void;
}) {
  const fetcher = useFetcher<ActionResult | CreateResult>();
  const formRef = useRef<HTMLFormElement>(null);
  const [type, setType] = useState<ProviderType>(provider?.type ?? initialType);
  const specialtyListId = useId();

  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  const issues = result && !result.ok ? result.issues : [];
  const busy = fetcher.state !== "idle";

  // A save goes to `onDone`; a refusal moves focus to the first field it's about.
  const handled = useRef<ActionResult | CreateResult | undefined>(undefined);
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data || handled.current === fetcher.data) return;
    handled.current = fetcher.data;
    if (fetcher.data.ok) onDone("id" in fetcher.data ? fetcher.data.id : undefined);
    // On another tab, it switches there: a frame later, as FormTabs can't switch
    // synchronously from inside an effect (its flushSync is a no-op here).
    else requestAnimationFrame(() => revealField(formRef.current));
  }, [fetcher.state, fetcher.data, onDone]);

  const choices = practices.filter((p) => p.id !== provider?.id);
  // A practice that's gone (deleted since) still shows, so saving doesn't drop it unasked.
  const currentPractice = provider?.practiceId ?? draft?.practiceId ?? "";
  const missingPractice = !!currentPractice && !choices.some((p) => p.id === currentPractice);
  const meta = SPECIALTY[type];
  const general = result && !result.ok && issues.length === 0 ? result.error : undefined;
  // More is marked when it holds a value the provider (or a quick-entry draft) brought.
  const moreHasContent = !!(
    provider?.email ||
    provider?.address ||
    provider?.website ||
    provider?.isPrimary ||
    provider?.status === "past" ||
    draft?.address
  );

  return (
    <fetcher.Form method="post" ref={formRef} className="space-y-1" noValidate data-provider-form>
      <input type="hidden" name="intent" value={provider ? "update" : "create"} />

      <FormTabs
        label="Provider sections"
        tabs={[
          {
            id: "essentials",
            label: "Essentials",
            panel: (
              <div className="space-y-1">
                <ChoiceGroup
                  name={FIELD.type}
                  label="Type"
                  options={TYPE_OPTIONS}
                  value={type}
                  onChange={setType}
                  error={issueFor(issues, "type")}
                  required
                />

                <Field label="Name" kind="input" error={issueFor(issues, "name")} required>
                  {(control) => (
                    <input
                      {...control}
                      name={FIELD.name}
                      maxLength={PROVIDER_LIMITS.name}
                      defaultValue={provider?.name ?? draft?.name ?? ""}
                      placeholder={NAME_PLACEHOLDER[type]}
                      autoComplete="off"
                    />
                  )}
                </Field>

                <Field label={meta.label} kind="input" error={issueFor(issues, "specialty")}>
                  {(control) => (
                    <input
                      {...control}
                      name={FIELD.specialty}
                      maxLength={PROVIDER_LIMITS.specialty}
                      defaultValue={provider?.specialty ?? draft?.specialty ?? ""}
                      placeholder={meta.placeholder}
                      autoComplete="off"
                      list={specialtyListId}
                    />
                  )}
                </Field>
                {/* Suggestions only (B-923): a typed value saves as typed. */}
                <datalist id={specialtyListId} data-specialty-suggestions>
                  {SPECIALTY_SUGGESTIONS[type].map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>

                {hasPractice(type) && (
                  <Field label="Practice" kind="select" error={issueFor(issues, "practiceId")}>
                    {(control) => (
                      <select {...control} name={FIELD.practiceId} defaultValue={currentPractice}>
                        <option value="">None</option>
                        {choices.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                            {p.type === "pharmacy" ? " (pharmacy)" : ""}
                          </option>
                        ))}
                        {missingPractice && <option value={currentPractice}>(removed practice)</option>}
                      </select>
                    )}
                  </Field>
                )}

                <PhoneFields
                  initial={
                    provider?.phones ?? (draft?.phone ? [{ label: "", number: draft.phone }] : undefined)
                  }
                  issues={issues}
                  labelOptions={PHONE_LABELS}
                />
              </div>
            ),
          },
          {
            id: "more",
            label: "More",
            hasContent: moreHasContent,
            panel: (
              <div className="space-y-1">
                <Field label="Email" kind="input" error={issueFor(issues, "email")}>
                  {(control) => (
                    <input
                      {...control}
                      name={FIELD.email}
                      type="email"
                      inputMode="email"
                      maxLength={PROVIDER_LIMITS.email}
                      defaultValue={provider?.email ?? ""}
                      autoComplete="off"
                    />
                  )}
                </Field>

                <Field label="Address" kind="textarea" error={issueFor(issues, "address")}>
                  {(control) => (
                    <textarea
                      {...control}
                      name={FIELD.address}
                      rows={2}
                      maxLength={PROVIDER_LIMITS.address}
                      defaultValue={provider?.address ?? draft?.address ?? ""}
                    />
                  )}
                </Field>

                <Field label="Website" kind="input" error={issueFor(issues, "website")}>
                  {(control) => (
                    <input
                      {...control}
                      name={FIELD.website}
                      inputMode="url"
                      maxLength={PROVIDER_LIMITS.website}
                      defaultValue={provider?.website ?? ""}
                      placeholder="e.g. clinic.example"
                      autoComplete="off"
                    />
                  )}
                </Field>

                <fieldset className="fieldset gap-2 pt-2">
                  <legend className="sr-only">Status</legend>
                  <CheckField
                    name={FIELD.isPrimary}
                    label="Primary"
                    help="Pinned at the top of the list"
                    defaultChecked={provider?.isPrimary ?? false}
                  />
                  <CheckField
                    name={FIELD.past}
                    label="Past"
                    help="No longer seen; listed under Past providers"
                    defaultChecked={provider?.status === "past"}
                  />
                </fieldset>
              </div>
            ),
          },
        ]}
      />

      {general && <Message tone="error">{general}</Message>}

      {/* The footer has its own top padding, so Delete lines up with its buttons from the bottom. */}
      <div className="flex flex-wrap items-end gap-2">
        {onDelete && (
          <Button variant="dangerQuiet" onClick={onDelete}>
            Delete provider
          </Button>
        )}
        <FormFooter
          className="ms-auto"
          submitLabel={provider ? "Save" : "Add provider"}
          busy={busy}
          cancel={{ label: "Cancel", onCancel }}
        />
      </div>
    </fetcher.Form>
  );
}
