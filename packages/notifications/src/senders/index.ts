import type { MailConfig } from "../config";
import type { Sender } from "./types";

import { getMailConfig } from "../config";
import { withAllowlist } from "./allowlist";
import { createLogSender } from "./log";
import { sharedMemorySender } from "./memory";
import { createResendSender } from "./resend";

export * from "./allowlist";
export * from "./memory";
export type * from "./types";

/** The sender `config` names. Only Resend sends real email, so only it is allowlisted. */
export const createSender = (config: MailConfig): Sender => {
  switch (config.sender) {
    case "memory":
      return sharedMemorySender();
    case "log":
      return createLogSender({ appUrl: config.appUrl });
    case "resend": {
      // getMailConfig refuses resend without a key.
      const resend = createResendSender({ apiKey: config.resendApiKey ?? "" });
      return config.production ? resend : withAllowlist(resend, config.allowlist);
    }
  }
};

let cached: { key: string; sender: Sender } | undefined;

/** The configured sender (MAIL_SENDER), made once per configuration. */
export const getSender = (config: MailConfig = getMailConfig()): Sender => {
  const key = JSON.stringify(config);
  if (cached?.key !== key) cached = { key, sender: createSender(config) };
  return cached.sender;
};
