import type { Route } from "./+types/route";
import type { AdminActionResult } from "../adminForms";

import { APP_SETTING_KEYS, APP_SETTINGS, isAppSettingKey } from "@caretook/data/schema";
import { requireStaff } from "~/.server/admin";
import { formString } from "~/lib/form";
import { adminFailure } from "../adminForms";
import { SettingCard } from "./SettingCard";
import { formIssuePath, settingFromForm } from "./settingForms";

// /admin/settings (admin PRD): what staff change without a deploy, one form
// per setting with its current value and default. Admins change them, with
// a reason, and each change is in the audit log; support reads them. A
// change reaches every server within a minute (settings are cached 30 s).

export const meta = () => [{ title: "Settings · Caretook admin" }, { name: "robots", content: "noindex" }];

export async function loader({ request }: Route.LoaderArgs) {
  const { api, capabilities } = await requireStaff(request, "settings.read");
  return { settings: await api.admin.settings.list(), canWrite: capabilities.includes("settings.write") };
}

export type SettingActionResult = AdminActionResult & { key?: string };

export async function action({ request }: Route.ActionArgs): Promise<SettingActionResult> {
  const { api } = await requireStaff(request, "settings.write");
  const form = await request.formData();
  const field = (name: string) => formString(form, name);
  const key = field("key");
  if (!isAppSettingKey(key)) return { ok: false, error: "There's no such setting.", issues: [] };
  const reason = field("reason").trim();
  const parsed = settingFromForm(key, field);
  const issues = parsed.ok ? [] : [...parsed.issues];
  if (!reason) issues.push({ path: "reason", message: "Say why you're changing it" });
  if (!parsed.ok || issues.length) return { ok: false, key, error: "Check the form and try again.", issues };
  try {
    const saved = await api.admin.settings.set({ key, value: parsed.value, reason });
    const label = APP_SETTINGS[key].label;
    return { ok: true, key, message: saved.changed ? `${label} saved.` : `${label} was already that.` };
  } catch (e) {
    const failed = adminFailure(e);
    if (failed.ok) return { ...failed, key };
    return { ...failed, key, issues: failed.issues.map((i) => ({ ...i, path: formIssuePath(key, i.path) })) };
  }
}

export default function Settings({ loaderData, actionData }: Route.ComponentProps) {
  const { settings, canWrite } = loaderData;
  const byKey = new Map(settings.map((s) => [s.key, s]));
  return (
    <section className="card bg-base-100 shadow-sm" aria-labelledby="settings">
      <div className="card-body gap-4">
        <h1 id="settings" className="card-title">
          Settings
        </h1>
        <p className="text-base-content/70 text-sm">
          {canWrite
            ? "Changes take effect within a minute, and each one is in the audit log with its reason."
            : "Only admins can change these."}
        </p>
        <ul className="space-y-4" data-settings="">
          {APP_SETTING_KEYS.map((key) => {
            const setting = byKey.get(key);
            if (!setting) return null;
            return (
              <li key={key}>
                <SettingCard
                  setting={setting}
                  canWrite={canWrite}
                  result={actionData?.key === key ? actionData : undefined}
                />
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
