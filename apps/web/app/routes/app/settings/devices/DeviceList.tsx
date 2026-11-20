import type { DevicesActionResult } from "./route";
import type { DeviceRow } from "./devices";

import { LogOut, Monitor, Smartphone } from "lucide-react";
import { useState } from "react";
import { useFetcher } from "react-router";
import { ConfirmDialog } from "~/components/ui";
import { formatAgo } from "~/lib/format";

const MOBILE = /\b(iPhone|iPad|Android)\b/;

/** What the confirm is about: one device, or every other one. */
type Pending = { kind: "one"; device: DeviceRow } | { kind: "others" } | null;

/** The account's sessions, this device first; Sign out on each other one, then Sign out everywhere else. */
export function DeviceList({ devices }: { devices: DeviceRow[] }) {
  const fetcher = useFetcher<DevicesActionResult>();
  const [pending, setPending] = useState<Pending>(null);
  // What the last sign-out was, said once it has gone through.
  const [asked, setAsked] = useState<string | null>(null);
  const busy = fetcher.state !== "idle";
  const others = devices.filter((d) => !d.current);

  const confirm = () => {
    if (!pending) return;
    if (pending.kind === "one") {
      setAsked(`Signed out ${pending.device.label}.`);
      void fetcher.submit({ intent: "signOut", id: pending.device.id }, { method: "post" });
    } else {
      setAsked("Signed out everywhere else.");
      void fetcher.submit({ intent: "signOutOthers" }, { method: "post" });
    }
    setPending(null);
  };

  return (
    <>
      <ul data-devices="" className="divide-base-300 divide-y">
        {devices.map((d) => {
          const Icon = MOBILE.test(d.label) ? Smartphone : Monitor;
          return (
            <li
              key={d.id}
              data-device={d.id}
              data-current={d.current ? "" : undefined}
              className="flex items-center gap-3 py-3"
            >
              <Icon aria-hidden="true" className="text-base-content/70 size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium" data-device-label="">
                  {d.label}
                </p>
                <p className="text-base-content/70 text-sm">
                  {d.current ? (
                    <span className="badge badge-sm badge-primary">This device</span>
                  ) : (
                    <>Last active {formatAgo(d.lastActive)}</>
                  )}
                </p>
              </div>
              {!d.current && (
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={busy}
                  aria-label={`Sign out ${d.label}, last active ${formatAgo(d.lastActive)}`}
                  onClick={() => setPending({ kind: "one", device: d })}
                >
                  Sign out
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {others.length > 0 ? (
        <div className="pt-2">
          <button
            type="button"
            data-sign-out-others=""
            className="btn gap-2"
            disabled={busy}
            onClick={() => setPending({ kind: "others" })}
          >
            <LogOut aria-hidden="true" className="size-4" />
            Sign out everywhere else
          </button>
        </div>
      ) : (
        <p className="text-base-content/70 text-sm">You&apos;re not signed in anywhere else.</p>
      )}
      <p role="status" className="text-sm empty:hidden">
        {busy ? "Signing out…" : fetcher.data?.ok ? (asked ?? "") : ""}
      </p>
      {fetcher.state === "idle" && fetcher.data && !fetcher.data.ok && (
        <p role="alert" className="text-error text-sm">
          {fetcher.data.error}
        </p>
      )}
      <ConfirmDialog
        open={!!pending}
        title={pending?.kind === "one" ? `Sign out ${pending.device.label}?` : "Sign out everywhere else?"}
        message={
          pending?.kind === "one"
            ? "It goes to sign-in the next time it's online, and stops getting updates within 15 minutes."
            : `${others.length === 1 ? "The other device goes" : `All ${others.length} other devices go`} to sign-in the next time they're online. This device stays signed in.`
        }
        confirmLabel="Sign out"
        onConfirm={confirm}
        onClose={() => setPending(null)}
      />
    </>
  );
}
