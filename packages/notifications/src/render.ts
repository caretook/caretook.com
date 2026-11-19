import type { z } from "zod";
import type { EmailContent, EmailContext } from "./define";
import type { NotificationName, Notifications } from "./registry";

import { newError } from "@caretook/data/errors";
import { render } from "@react-email/render";
import { linkBuilder } from "./links";
import { NOTIFICATIONS } from "./registry";

export type NotificationData<N extends NotificationName> = z.input<Notifications[N]["data"]>;

export type RenderedNotification = { subject: string; html: string; text: string };

const issuesOf = (error: z.ZodError) =>
  error.issues.map(({ path, message }) => ({ path: path.join("."), message }));

/**
 * Validate `data` against the notification's schema, then render its email
 * to HTML and plain text. Bad data is refused before anything renders.
 */
export const renderNotification = async <N extends NotificationName>(
  name: N,
  data: NotificationData<N>,
  { recipient, appUrl }: { recipient: string; appUrl: string },
) => {
  const definition = NOTIFICATIONS[name];
  if (!definition) return newError({ code: "notify:invalidData", meta: { name } });

  const parsed = definition.data.safeParse(data);
  if (!parsed.success) {
    return newError({ code: "notify:invalidData", meta: { name, issues: issuesOf(parsed.error) } });
  }

  try {
    // The data just parsed with this definition's own schema; TypeScript
    // can't correlate the two through the union of every notification.
    const email = definition.email as (data: unknown, ctx: EmailContext) => EmailContent;
    const { subject, react } = email(parsed.data, {
      recipient,
      link: linkBuilder(appUrl),
    });
    const [html, text] = await Promise.all([render(react), render(react, { plainText: true })]);
    if (!subject.trim() || !text.trim()) throw new Error("Empty subject or text");
    return { subject: subject.trim(), html, text: text.trim() } satisfies RenderedNotification;
  } catch (cause) {
    return newError({ code: "notify:render", cause, meta: { name } });
  }
};
