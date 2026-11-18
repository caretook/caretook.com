import type { ProviderType } from "@caretook/data/schema";
import type { ActionResult, FieldIssue } from "~/lib/api";
import type { LocalProvider } from "~/lib/sync/providers";

import { Plus, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { PROVIDER_LIMITS, PROVIDER_TYPES } from "@caretook/data/schema";
import { PROVIDER_TYPE_META } from "~/lib/providerDirectory";
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

type PhoneRow = { key: number; label: string; number: string };

let phoneKeys = 0;
/** A phone row, keyed so removing one keeps the others' typed values. */
const phoneRow = (label = "", number = ""): PhoneRow => ({ key: phoneKeys++, label, number });

const issueFor = (issues: FieldIssue[], path: string) => issues.find((i) => i.path === path)?.message;

/** A field's error line, tied to its input by id. */
function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null;
  return (
    <p id={id} className="text-error text-sm" data-field-error>
      {message}
    </p>
  );
}

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
  onDone,
  onCancel,
  onDelete,
}: {
  /** Editing this provider; omit to add one. */
  provider?: LocalProvider;
  initialType?: ProviderType;
  practices: LocalProvider[];
  onDone: () => void;
  onCancel: () => void;
  /** Editing: asks to delete the provider. */
  onDelete?: () => void;
}) {
  const fetcher = useFetcher<ActionResult>();
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [type, setType] = useState<ProviderType>(provider?.type ?? initialType);
  const [phones, setPhones] = useState<PhoneRow[]>(() =>
    provider ? provider.phones.map((p) => phoneRow(p.label, p.number)) : [phoneRow()],
  );

  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  const issues = result && !result.ok ? result.issues : [];
  const busy = fetcher.state !== "idle";

  // A save closes the sheet; a refusal moves focus to the first field it's about.
  const handled = useRef<ActionResult | undefined>(undefined);
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data || handled.current === fetcher.data) return;
    handled.current = fetcher.data;
    if (fetcher.data.ok) onDone();
    else formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [fetcher.state, fetcher.data, onDone]);

  const field = (name: string) => {
    const message = issueFor(issues, name);
    const errorId = `${id}-${name.replace(/\./g, "-")}-error`;
    return {
      message,
      errorId,
      props: { "aria-invalid": !!message, "aria-describedby": message ? errorId : undefined },
    };
  };
  const name = field("name");
  const specialty = field("specialty");
  const practice = field("practiceId");
  const phoneCount = field("phones");
  const email = field("email");
  const address = field("address");
  const website = field("website");

  const choices = practices.filter((p) => p.id !== provider?.id);
  // A practice that's gone (deleted since) still shows, so saving doesn't drop it unasked.
  const currentPractice = provider?.practiceId ?? "";
  const missingPractice = !!currentPractice && !choices.some((p) => p.id === currentPractice);
  const full = phones.length >= PROVIDER_LIMITS.phones;
  const meta = SPECIALTY[type];
  const general = result && !result.ok && issues.length === 0 ? result.error : undefined;

  return (
    <fetcher.Form method="post" ref={formRef} className="space-y-1" noValidate data-provider-form>
      <input type="hidden" name="intent" value={provider ? "update" : "create"} />

      <fieldset className="fieldset">
        <legend className="fieldset-legend">Type</legend>
        <div className="join flex-wrap">
          {PROVIDER_TYPES.map((t) => (
            <input
              key={t}
              type="radio"
              name={FIELD.type}
              value={t}
              aria-label={PROVIDER_TYPE_META[t].label}
              checked={type === t}
              onChange={() => setType(t)}
              className="join-item btn btn-sm"
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="fieldset">
        <label className="fieldset-legend" htmlFor={`${id}-name`}>
          Name
        </label>
        <input
          id={`${id}-name`}
          name={FIELD.name}
          className="input w-full"
          maxLength={PROVIDER_LIMITS.name}
          defaultValue={provider?.name ?? ""}
          placeholder={NAME_PLACEHOLDER[type]}
          autoComplete="off"
          {...name.props}
        />
        <FieldError id={name.errorId} message={name.message} />
      </fieldset>

      <fieldset className="fieldset">
        <label className="fieldset-legend" htmlFor={`${id}-specialty`}>
          {meta.label} (optional)
        </label>
        <input
          id={`${id}-specialty`}
          name={FIELD.specialty}
          className="input w-full"
          maxLength={PROVIDER_LIMITS.specialty}
          defaultValue={provider?.specialty ?? ""}
          placeholder={meta.placeholder}
          autoComplete="off"
          {...specialty.props}
        />
        <FieldError id={specialty.errorId} message={specialty.message} />
      </fieldset>

      {hasPractice(type) && (
        <fieldset className="fieldset">
          <label className="fieldset-legend" htmlFor={`${id}-practice`}>
            Practice (optional)
          </label>
          <select
            id={`${id}-practice`}
            name={FIELD.practiceId}
            className="select w-full"
            defaultValue={currentPractice}
            {...practice.props}
          >
            <option value="">None</option>
            {choices.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.type === "pharmacy" ? " (pharmacy)" : ""}
              </option>
            ))}
            {missingPractice && <option value={currentPractice}>(removed practice)</option>}
          </select>
          <FieldError id={practice.errorId} message={practice.message} />
        </fieldset>
      )}

      <fieldset className="fieldset" aria-describedby={phoneCount.message ? phoneCount.errorId : undefined}>
        <legend className="fieldset-legend">Phone numbers</legend>
        <ul className="space-y-2" data-phones>
          {phones.map((phone, i) => {
            const number = field(`phones.${i}.number`);
            const label = field(`phones.${i}.label`);
            const n = i + 1;
            return (
              <li key={phone.key} className="space-y-1" data-phone-row>
                <div className="flex items-center gap-2">
                  <input
                    name={FIELD.phoneLabel}
                    aria-label={`Phone ${n} label`}
                    className="input w-28 shrink-0"
                    maxLength={PROVIDER_LIMITS.phoneLabel}
                    defaultValue={phone.label}
                    placeholder="Office"
                    autoComplete="off"
                    {...label.props}
                  />
                  <input
                    name={FIELD.phoneNumber}
                    type="tel"
                    aria-label={`Phone ${n} number`}
                    className="input min-w-0 flex-1"
                    maxLength={PROVIDER_LIMITS.phoneNumber}
                    defaultValue={phone.number}
                    placeholder="(555) 010-0000"
                    autoComplete="off"
                    {...number.props}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-square shrink-0"
                    aria-label={`Remove phone ${n}`}
                    onClick={() => setPhones((rows) => rows.filter((r) => r.key !== phone.key))}
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>
                <FieldError id={label.errorId} message={label.message} />
                <FieldError id={number.errorId} message={number.message} />
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={full}
            onClick={() => setPhones((rows) => [...rows, phoneRow()])}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add a phone number
          </button>
          {full && (
            <span className="text-base-content/70 text-sm">{PROVIDER_LIMITS.phones} numbers is the most</span>
          )}
        </div>
        <FieldError id={phoneCount.errorId} message={phoneCount.message} />
      </fieldset>

      <fieldset className="fieldset">
        <label className="fieldset-legend" htmlFor={`${id}-email`}>
          Email (optional)
        </label>
        <input
          id={`${id}-email`}
          name={FIELD.email}
          type="email"
          inputMode="email"
          className="input w-full"
          maxLength={PROVIDER_LIMITS.email}
          defaultValue={provider?.email ?? ""}
          autoComplete="off"
          {...email.props}
        />
        <FieldError id={email.errorId} message={email.message} />
      </fieldset>

      <fieldset className="fieldset">
        <label className="fieldset-legend" htmlFor={`${id}-address`}>
          Address (optional)
        </label>
        <textarea
          id={`${id}-address`}
          name={FIELD.address}
          className="textarea w-full"
          rows={2}
          maxLength={PROVIDER_LIMITS.address}
          defaultValue={provider?.address ?? ""}
          {...address.props}
        />
        <FieldError id={address.errorId} message={address.message} />
      </fieldset>

      <fieldset className="fieldset">
        <label className="fieldset-legend" htmlFor={`${id}-website`}>
          Website (optional)
        </label>
        <input
          id={`${id}-website`}
          name={FIELD.website}
          inputMode="url"
          className="input w-full"
          maxLength={PROVIDER_LIMITS.website}
          defaultValue={provider?.website ?? ""}
          placeholder="e.g. clinic.example"
          autoComplete="off"
          {...website.props}
        />
        <FieldError id={website.errorId} message={website.message} />
      </fieldset>

      <fieldset className="fieldset gap-2 pt-2">
        <legend className="sr-only">Status</legend>
        <label className="label text-base-content cursor-pointer items-start gap-3 whitespace-normal">
          <input
            type="checkbox"
            name={FIELD.isPrimary}
            className="checkbox checkbox-sm mt-0.5"
            defaultChecked={provider?.isPrimary ?? false}
          />
          <span>
            Primary
            <span className="text-base-content/70 block text-sm">Pinned at the top of the list</span>
          </span>
        </label>
        <label className="label text-base-content cursor-pointer items-start gap-3 whitespace-normal">
          <input
            type="checkbox"
            name={FIELD.past}
            className="checkbox checkbox-sm mt-0.5"
            defaultChecked={provider?.status === "past"}
          />
          <span>
            Past
            <span className="text-base-content/70 block text-sm">
              No longer seen; listed behind “Show past”
            </span>
          </span>
        </label>
      </fieldset>

      {general && (
        <p role="alert" className="text-error text-sm">
          {general}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-3">
        {onDelete && (
          <button type="button" className="btn btn-ghost text-error mr-auto" onClick={onDelete}>
            Delete provider
          </button>
        )}
        <div className="ml-auto flex gap-2">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {provider ? "Save" : "Add provider"}
          </button>
        </div>
      </div>
    </fetcher.Form>
  );
}
