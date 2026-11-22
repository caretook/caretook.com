import { WifiOff } from "lucide-react";
import { Notice } from "~/components/ui";
import { Example } from "../Example";

export function NoticeSection() {
  return (
    <>
      <Example label="Tones">
        <div className="w-full space-y-2">
          <Notice tone="error">This note was deleted on another device.</Notice>
          <Notice tone="success">Invite sent to sam@example.test.</Notice>
          <Notice tone="warning">Your changes will upload when you're back online.</Notice>
          <Notice tone="info">Check your email for a sign-in link.</Notice>
        </div>
      </Example>
      <Example label="Its own icon, and an action">
        <div className="w-full space-y-2">
          <Notice icon={WifiOff}>You're offline. These settings need a connection.</Notice>
          <Notice tone="warning" action={{ label: "Try again", onAction: () => undefined }}>
            Couldn't reach Google Calendar.
          </Notice>
          <Notice action={{ label: "Open settings", to: "/dev/ui" }}>
            Reminders are off for this group.
          </Notice>
        </div>
      </Example>
    </>
  );
}
