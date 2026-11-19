import { deviceLabel } from "../../../../lib/deviceLabel";

// The Devices page's pure parts: Better Auth's sessions as the rows it shows
// (never their tokens), and its wording.

/** What Better Auth's `listSessions` gives for each session (dates as Date or ISO text). */
export type SessionLike = {
  id: string;
  userAgent?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type DeviceRow = {
  id: string;
  label: string;
  /** ISO 8601: when the session was last refreshed (about once a day while it's used). */
  lastActive: string;
  current: boolean;
};

const iso = (d: Date | string) => new Date(d).toISOString();
const later = (a: Date | string, b: Date | string) => (new Date(a) > new Date(b) ? a : b);

/** This device first, then the others, most recently active first. */
export const deviceRows = (sessions: readonly SessionLike[], currentId: string | null): DeviceRow[] =>
  sessions
    .map((s) => ({
      id: s.id,
      label: deviceLabel(s.userAgent),
      lastActive: iso(later(s.updatedAt, s.createdAt)),
      current: s.id === currentId,
    }))
    .sort((a, b) => Number(b.current) - Number(a.current) || b.lastActive.localeCompare(a.lastActive));

export const OFFLINE_DEVICES = "Needs a connection to show your devices and sign them out.";
export const SIGN_OUT_FAILED = "Couldn't sign that device out. Try again.";

/** The form's posts: one device, or every other one. */
export type DevicesIntent = { intent: "signOut"; id: string } | { intent: "signOutOthers" } | null;

export const devicesIntent = (form: FormData): DevicesIntent => {
  const intent = form.get("intent");
  const id = form.get("id");
  if (intent === "signOutOthers") return { intent };
  if (intent === "signOut" && typeof id === "string" && id) return { intent, id };
  return null;
};
