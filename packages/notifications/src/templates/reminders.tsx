import type { MailHeaders } from "../define";
import type { LinkBuilder } from "../links";

import { calendarSettingService } from "@caretook/data";
import { Link } from "react-email";
import { z } from "zod";
import { defineNotification } from "../define";
import { appPathZ } from "./appPath";
import { ButtonLink, EmailLayout, Muted, Paragraph } from "./layout";
import { readReminderKey } from "@caretook/data/domain";

// Reminder emails (appointments-2 slice 6): an appointment or reminder
// coming up (`appointmentReminder`) and a todo due (`todoDue`), sent by the
// calendar cron's reminder sweep. The wording comes from `calendarText`:
// generic by default ("Event for Pat", the time and a link back), with
// the title, place and providers only when the member consented and the
// owners allow it. No note content ever. Each carries a one-click
// unsubscribe link and `List-Unsubscribe` (RFC 8058), which turn reminders
// off for that member in that group. Email is their one channel for now.

/** The web-only page a reminder's unsubscribe link opens. */
export const REMINDER_UNSUBSCRIBE_PATH = "/api/reminders/unsubscribe";

/** The unsubscribe link's path for `userId` in `groupId`, or null where it can't be signed. */
export const reminderUnsubscribePath = (userId: string, groupId: string) => {
  const token = calendarSettingService.unsubscribeToken(userId, groupId);
  return token ? `${REMINDER_UNSUBSCRIBE_PATH}/${token}` : null;
};

/** `List-Unsubscribe` and its one-click partner, from the send's key (`reminder:<user>:<group>:…`). */
const unsubscribeHeaders = (
  { idempotencyKey }: { idempotencyKey: string },
  { link }: { link: LinkBuilder },
) => {
  const target = readReminderKey(idempotencyKey);
  const path = target && reminderUnsubscribePath(target.userId, target.groupId);
  if (!path) return null;
  return {
    "List-Unsubscribe": `<${link(path)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  } satisfies MailHeaders;
};

const textZ = (max: number) => z.string().trim().min(1).max(max);

const reminderDataZ = z.object({
  /** calendarText's summary: "Event for Pat", or with details "Event for Pat: Dialysis". */
  summary: textZ(300),
  /** When, in the member's zone: "Thu, Nov 19 · 9:00–10:00 AM PST". */
  when: textZ(120),
  /** Details only. */
  location: z.string().trim().max(300).nullish(),
  /** Details only: linked providers' names. */
  providers: z.array(textZ(200)).max(20).default([]),
  /** The care recipient's name, for "Pat's care group". */
  recipientName: textZ(200),
  itemPath: appPathZ,
  unsubscribePath: appPathZ,
});

export type ReminderEmailData = z.input<typeof reminderDataZ>;

const ReminderEmail = ({
  data,
  link,
  button,
}: {
  data: z.output<typeof reminderDataZ>;
  link: LinkBuilder;
  button: string;
}) => (
  <EmailLayout preview={data.when}>
    <Paragraph>
      <strong>{data.summary}</strong>
    </Paragraph>
    <Paragraph>{data.when}</Paragraph>
    {data.location ? <Paragraph>At {data.location}</Paragraph> : null}
    {data.providers.length ? <Paragraph>With {data.providers.join(", ")}</Paragraph> : null}
    <ButtonLink href={link(data.itemPath)}>{button}</ButtonLink>
    <Muted>
      You get these because you turned on reminder emails for {data.recipientName}'s care group on Caretook.{" "}
      <Link href={link(data.unsubscribePath)} style={{ color: "#656d76", textDecoration: "underline" }}>
        Turn off reminder emails
      </Link>
    </Muted>
  </EmailLayout>
);

export const appointmentReminder = defineNotification({
  name: "appointmentReminder",
  data: reminderDataZ,
  email: (data, { link }) => ({
    subject: `${data.summary} · ${data.when}`,
    react: <ReminderEmail data={data} link={link} button="Open in Caretook" />,
  }),
  headers: unsubscribeHeaders,
});

export const todoDue = defineNotification({
  name: "todoDue",
  data: reminderDataZ,
  email: (data, { link }) => ({
    subject: `${data.summary} · ${data.when}`,
    react: <ReminderEmail data={data} link={link} button="Open the todo" />,
  }),
  headers: unsubscribeHeaders,
});
