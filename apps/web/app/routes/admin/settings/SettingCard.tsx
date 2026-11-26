import type { Announcement, AnnouncementTone, AppSettingKey } from "@caretook/data/schema";
import type { SettingActionResult } from "./route";

import { ANNOUNCEMENT_MAX, ANNOUNCEMENT_TONES, APP_SETTINGS } from "@caretook/data/schema";
import { useState } from "react";
import { Form, useNavigation } from "react-router";
import { AnnouncementBanner } from "~/components/shell";
import { ChoiceGroup, Field, FormFooter, Message, Notice } from "~/components/ui";
import { issueFor } from "../adminForms";
import { localInputFromUtc, SETTING_FORMS, settingValueText } from "./settingForms";

// One setting on /admin/settings: its name, what it does, its value and
// default, and (admins) a form to change it with a reason. Support sees the
// same card without the form.

export type SettingRow = {
  key: AppSettingKey;
  value: unknown;
  isDefault: boolean;
  updatedAt: string | null;
};

const SWITCH_OPTIONS = [
  { value: "on", label: "On" },
  { value: "off", label: "Off" },
] as const;

const TONE_LABELS: Record<string, string> = { info: "Info", warning: "Warning" };
const TONE_OPTIONS = ANNOUNCEMENT_TONES.map((tone) => ({ value: tone, label: TONE_LABELS[tone] ?? tone }));

const changedOn = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

export function SettingCard({
  setting,
  canWrite,
  result,
}: {
  setting: SettingRow;
  canWrite: boolean;
  result: SettingActionResult | undefined;
}) {
  const { key, value } = setting;
  const spec = APP_SETTINGS[key];
  const headingId = `setting-${key.replace(/\W/g, "-")}`;
  return (
    <section
      aria-labelledby={headingId}
      className="border-base-300 rounded-box border p-4"
      data-setting={key}
      data-value={JSON.stringify(value)}
    >
      <h2 id={headingId} className="font-semibold">
        {spec.label}
      </h2>
      <p className="text-muted text-sm">{spec.help}</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 text-sm">
        <dt className="text-muted">Now</dt>
        <dd data-setting-value="">{settingValueText(key, value)}</dd>
        <dt className="text-muted">Default</dt>
        <dd>
          {spec.defaultText}
          {setting.isDefault ? " (in use)" : ""}
        </dd>
        {setting.updatedAt && (
          <>
            <dt className="text-muted">Changed</dt>
            <dd>{changedOn(setting.updatedAt)}</dd>
          </>
        )}
      </dl>
      {canWrite && <SettingForm settingKey={key} value={value} result={result} />}
    </section>
  );
}

function SettingForm({
  settingKey: key,
  value,
  result,
}: {
  settingKey: AppSettingKey;
  value: unknown;
  result: SettingActionResult | undefined;
}) {
  const navigation = useNavigation();
  const busy = navigation.state !== "idle" && navigation.formData?.get("key") === key;
  const form = SETTING_FORMS[key];
  const issue = (path: string) => issueFor(result, path);
  // A saved change reloads the page's data; the form starts again from it.
  const formKey = JSON.stringify(value);
  return (
    <Form key={formKey} method="post" className="mt-2 space-y-1" data-setting-form={key}>
      <input type="hidden" name="key" value={key} />
      {form === "switch" && (
        <ChoiceGroup
          name="value"
          label="Change to"
          required
          options={SWITCH_OPTIONS}
          defaultValue={value ? "on" : "off"}
          error={issue("value")}
        />
      )}
      {form === "number" && (
        <Field kind="input" label="Change to" required error={issue("value")}>
          {(control) => (
            <input
              {...control}
              name="value"
              type="number"
              inputMode="numeric"
              min={1}
              defaultValue={String(value)}
              className={`${control.className} max-w-40`}
              required
            />
          )}
        </Field>
      )}
      {form === "list" && (
        <Field
          kind="textarea"
          label="Change to"
          help="One address or @domain per line. Empty: use MAIL_ALLOWLIST."
          error={issue("value")}
        >
          {(control) => (
            <textarea
              {...control}
              name="value"
              rows={3}
              defaultValue={Array.isArray(value) ? (value as string[]).join("\n") : ""}
            />
          )}
        </Field>
      )}
      {form === "announcement" && <AnnouncementFields value={value as Announcement | null} issue={issue} />}
      <Field
        kind="input"
        label="Reason"
        required
        help="Why you're changing it. Goes in the audit log."
        error={issue("reason")}
      >
        {(control) => <input {...control} name="reason" maxLength={500} required />}
      </Field>
      {result && !result.ok && !result.issues.length && <Message tone="error">{result.error}</Message>}
      {result?.ok && <Notice tone="success">{result.message}</Notice>}
      <FormFooter align="start" submitLabel="Save" busy={busy} busyLabel="Saving…" />
    </Form>
  );
}

function AnnouncementFields({
  value,
  issue,
}: {
  value: Announcement | null;
  issue: (path: string) => string | undefined;
}) {
  const [text, setText] = useState(value?.text ?? "");
  const [tone, setTone] = useState<AnnouncementTone>(value?.tone ?? "info");
  return (
    <>
      <Field kind="textarea" label="Text" help="Empty clears the announcement." error={issue("text")}>
        {(control) => (
          <textarea
            {...control}
            name="text"
            rows={2}
            maxLength={ANNOUNCEMENT_MAX}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        )}
      </Field>
      <ChoiceGroup
        name="tone"
        label="Tone"
        required
        options={TONE_OPTIONS}
        value={tone}
        onChange={setTone}
        error={issue("tone")}
      />
      <div className="fieldset" data-announcement-preview="">
        <span className="fieldset-legend">Preview</span>
        {text.trim() ? (
          <div className="border-base-300 overflow-hidden rounded-box border">
            <AnnouncementBanner text={text.trim()} tone={tone} />
          </div>
        ) : (
          <p className="text-muted text-sm">No banner: saving clears it.</p>
        )}
      </div>
      <Field
        kind="input"
        label="Ends (UTC)"
        help="It stops showing then. Empty keeps it up."
        error={issue("endsAt")}
      >
        {(control) => (
          <input
            {...control}
            name="endsAt"
            type="datetime-local"
            defaultValue={localInputFromUtc(value?.endsAt)}
            className={`${control.className} max-w-64`}
          />
        )}
      </Field>
    </>
  );
}
