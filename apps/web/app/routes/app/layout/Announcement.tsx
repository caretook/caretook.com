import { AnnouncementBanner } from "~/components/shell";
import { useAnnouncement } from "./useAnnouncement";

/** The `announcement` region's content: staff's banner, until it ends or this device dismisses it. */
export function Announcement({ pathname }: { pathname: string }) {
  const { announcement, dismiss } = useAnnouncement(pathname);
  if (!announcement) return null;
  return (
    <AnnouncementBanner
      id={announcement.id}
      text={announcement.text}
      tone={announcement.tone}
      onDismiss={dismiss}
    />
  );
}
