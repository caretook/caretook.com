import type { AvatarChoice } from "@caretook/data/schema";
import type { LucideIcon } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import type { ActionResult } from "~/lib/core/api";

import { AVATAR_COLORS, AVATAR_ICONS } from "@caretook/data/schema";
import { CircleOff } from "lucide-react";
import { useId, useState } from "react";
import { SaveRow, SettingsCard } from "~/components/settings";
import { avatarColorClass, avatarIconGlyph, UserAvatar } from "~/components/ui";
import { saveMyAvatar, useMyAvatar } from "~/lib/app-shell/myAvatar";
import { toActionResult } from "~/lib/core/api";

const labelOf = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);

const failure = (e: unknown): ActionResult => {
  try {
    return toActionResult(e);
  } catch {
    return { ok: false, error: "Couldn't save that. Check your connection and try again.", issues: [] };
  }
};

/** One round choice: a native radio, its look beside it. */
function Swatch({
  name,
  label,
  checked,
  onChange,
  className,
  children,
}: {
  name: string;
  label: string;
  checked: boolean;
  onChange: () => void;
  className: string;
  children?: ReactNode;
}) {
  return (
    <label title={label} className="cursor-pointer">
      <input
        type="radio"
        name={name}
        aria-label={label}
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
      />
      <span
        className={`ring-offset-base-100 peer-checked:ring-base-content peer-focus-visible:outline-primary flex size-11 items-center justify-center rounded-full ring-offset-2 peer-checked:ring-2 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 ${className}`}
      >
        {children}
      </span>
    </label>
  );
}

function SwatchGroup({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className="space-y-2">
      <p id={id} className="text-sm font-semibold">
        {label}
      </p>
      <div role="radiogroup" aria-labelledby={id} className="flex flex-wrap gap-2">
        {children}
      </div>
    </div>
  );
}

const PENDING_TEXT = "Saved on this device. It'll sync when you're back online.";

const DEFAULT_LOOK = "bg-base-200 text-base-content border border-base-300";

function DefaultSwatch(props: { name: string; checked: boolean; onChange: () => void; icon: LucideIcon }) {
  const { icon: Icon, ...rest } = props;
  return (
    <Swatch label="Default" className={DEFAULT_LOOK} {...rest}>
      <Icon aria-hidden="true" className="size-5" />
    </Swatch>
  );
}

/**
 * Choose your avatar: a color and an icon from the fixed set, each with a
 * Default, and a live preview. One choice across all your care groups; made
 * offline, it's kept on this device and sent on reconnect.
 */
export function AvatarCard({ userId, name, email }: { userId: string; name: string | null; email: string }) {
  const saved = useMyAvatar(userId);
  const [draft, setDraft] = useState<AvatarChoice | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ActionResult>();
  const [queued, setQueued] = useState(false);
  const shown = draft ?? saved;

  const change = (next: Partial<AvatarChoice>) => {
    setDraft({ ...shown, ...next });
    setResult(undefined);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      setQueued((await saveMyAvatar(userId, shown)) === "pending");
      setDraft(null);
      setResult({ ok: true });
    } catch (e) {
      setResult(failure(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsCard id="avatar" title="Avatar">
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <div className="flex items-center gap-3">
          <UserAvatar data-avatar-preview="" name={name} email={email} look={shown} size="lg" />
          <p className="text-muted text-sm">Everyone in your care groups sees this.</p>
        </div>
        <SwatchGroup label="Color">
          <DefaultSwatch
            name="avatar-color"
            icon={CircleOff}
            checked={shown.color === null}
            onChange={() => change({ color: null })}
          />
          {AVATAR_COLORS.map((color) => (
            <Swatch
              key={color}
              name="avatar-color"
              label={labelOf(color)}
              checked={shown.color === color}
              onChange={() => change({ color })}
              className={avatarColorClass(color) ?? ""}
            />
          ))}
        </SwatchGroup>
        <SwatchGroup label="Icon">
          <DefaultSwatch
            name="avatar-icon"
            icon={CircleOff}
            checked={shown.icon === null}
            onChange={() => change({ icon: null })}
          />
          {AVATAR_ICONS.map((icon) => {
            const Glyph = avatarIconGlyph(icon);
            return (
              <Swatch
                key={icon}
                name="avatar-icon"
                label={labelOf(icon)}
                checked={shown.icon === icon}
                onChange={() => change({ icon })}
                className="bg-base-200 text-base-content"
              >
                {Glyph && <Glyph aria-hidden="true" className="size-5" />}
              </Swatch>
            );
          })}
        </SwatchGroup>
        <SaveRow busy={busy} result={result} savedText={queued ? PENDING_TEXT : undefined} />
      </form>
    </SettingsCard>
  );
}
