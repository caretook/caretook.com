import type { AnnouncementTone } from "@caretook/data/schema";

import { Info, TriangleAlert, X } from "lucide-react";
import { IconButton } from "~/components/ui";

const TONES: Record<AnnouncementTone, { className: string; icon: typeof Info; label: string }> = {
  info: { className: "bg-info/15 text-base-content border-info/40", icon: Info, label: "Announcement" },
  warning: {
    className: "bg-warning/20 text-base-content border-warning/50",
    icon: TriangleAlert,
    label: "Important announcement",
  },
};

/**
 * The `/app` announcement (admin slice 6): staff's text in the info or
 * warning tone, full width under the header, with a dismiss button when
 * `onDismiss` is given. /admin/settings renders it as the preview.
 */
export function AnnouncementBanner({
  text,
  tone,
  onDismiss,
  id,
}: {
  text: string;
  tone: AnnouncementTone;
  onDismiss?: () => void;
  /** Put on `data-announcement`, for checks. */
  id?: string;
}) {
  const { className, icon: Icon, label } = TONES[tone];
  return (
    <aside
      aria-label={label}
      data-announcement={id}
      data-tone={tone}
      className={`flex items-center gap-3 border-b px-4 py-2 sm:px-6 ${className}`}
    >
      <Icon aria-hidden className="size-5 shrink-0" />
      <p className="min-w-0 flex-1 text-sm break-words whitespace-pre-line">{text}</p>
      {onDismiss && <IconButton icon={X} label="Dismiss announcement" onPress={onDismiss} />}
    </aside>
  );
}
