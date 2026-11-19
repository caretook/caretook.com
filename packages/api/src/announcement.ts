import { activeAnnouncement, appSettingService } from "@caretook/data";
import { createHash } from "node:crypto";
import { publicProcedure } from "./procedures";

// `public.announcement` (admin slice 6): the `/app` banner, readable without
// signing in (the native build and a device whose session lapsed read it
// too). It carries nothing about anyone: the text, tone and end time staff
// set in /admin/settings, or null once it has ended or been cleared.

/**
 * An announcement's identity, for remembering a dismissal per device: its
 * tone and text, so moving the end time doesn't bring a dismissed banner
 * back, and a new text does.
 */
export const announcementId = (a: { tone: string; text: string }) =>
  createHash("sha256").update(`${a.tone}\n${a.text}`).digest("base64url").slice(0, 16);

export const announcement = publicProcedure.handler(async () => {
  const active = activeAnnouncement(await appSettingService.getSetting("announcement"), Date.now());
  if (!active) return null;
  return { id: announcementId(active), text: active.text, tone: active.tone, endsAt: active.endsAt ?? null };
});
