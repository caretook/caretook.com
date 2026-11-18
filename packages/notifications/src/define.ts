import type { ReactElement } from "react";
import type { z } from "zod";
import type { LinkBuilder } from "./links";

export type EmailContext = {
  /** The address the email goes to. */
  recipient: string;
  /** Builds an absolute link from an app path, on APP_URL. */
  link: LinkBuilder;
};

export type EmailContent = { subject: string; react: ReactElement };

export type NotificationDefinition<Name extends string, Data extends z.ZodType> = {
  name: Name;
  /**
   * The email carries a sign-in secret (a link token or a code). The outbox
   * keeps its body only until it's delivered (or fails for good), then
   * blanks the HTML and text, so the secret isn't left lying in the table.
   */
  sensitive?: boolean;
  /** Checked before rendering: notify() refuses data that doesn't parse. */
  data: Data;
  /**
   * The email channel. Templates get plain data and build every link with
   * `link`. No health details: names of people and groups are fine, a
   * symptom, reading, note or medication never is.
   */
  email: (data: z.output<Data>, ctx: EmailContext) => EmailContent;
};

/** One notification for `NOTIFICATIONS`. The identity function, for inference. */
export const defineNotification = <const Name extends string, Data extends z.ZodType>(
  definition: NotificationDefinition<Name, Data>,
) => definition;
