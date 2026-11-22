import type { DevicesActionResult } from "./route";
import type { DeviceRow } from "./devices";

import { LogOut, Monitor, Smartphone } from "lucide-react";
import { useState } from "react";
import { useFetcher } from "react-router";
import { Badge, Button, ConfirmDialog, EmptyState, List, ListRow, Message } from "~/components/ui";
import { formatAgo } from "~/lib/core/format";

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
      <List data-devices="">
        {devices.map((d) => {
          const Icon = MOBILE.test(d.label) ? Smartphone : Monitor;
          return (
            <ListRow
              key={d.id}
              data-device={d.id}
              data-current={d.current ? "" : undefined}
              trailing={
                !d.current && (
                  <Button
                    size="sm"
                    disabled={busy}
                    aria-label={`Sign out ${d.label}, last active ${formatAgo(d.lastActive)}`}
                    onClick={() => setPending({ kind: "one", device: d })}
                  >
                    Sign out
                  </Button>
                )
              }
            >
              <div className="flex items-center gap-3">
                <Icon aria-hidden="true" className="text-muted size-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium" data-device-label="">
                    {d.label}
                  </p>
                  <p className="text-muted text-sm">
                    {d.current ? (
                      <Badge tone="primary">This device</Badge>
                    ) : (
                      <>Last active {formatAgo(d.lastActive)}</>
                    )}
                  </p>
                </div>
              </div>
            </ListRow>
          );
        })}
      </List>
      {others.length > 0 ? (
        <div className="pt-2">
          <Button
            icon={LogOut}
            data-sign-out-others=""
            disabled={busy}
            onClick={() => setPending({ kind: "others" })}
          >
            Sign out everywhere else
          </Button>
        </div>
      ) : (
        <EmptyState>You&apos;re not signed in anywhere else.</EmptyState>
      )}
      <Message>{busy ? "Signing out…" : fetcher.data?.ok ? (asked ?? "") : ""}</Message>
      {fetcher.state === "idle" && fetcher.data && !fetcher.data.ok && (
        <Message tone="error">{fetcher.data.error}</Message>
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
