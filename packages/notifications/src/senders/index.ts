import type { MailConfig } from "../config";
import type { Sender } from "./types";

import { appSettingService } from "@caretook/data";
import { getMailConfig } from "../config";
import { withAllowlist } from "./allowlist";
import { createLogSender } from "./log";
import { sharedMemorySender } from "./memory";
import { createResendSender } from "./resend";

export * from "./allowlist";
export * from "./memory";
export type * from "./types";

/**
 * The allowlist at send time: the `mail.allowlist` app setting (changed in
 * /admin without a deploy), else MAIL_ALLOWLIST from the environment.
 */
export const settingsAllowlist = (fromEnv: readonly string[]) => async (): Promise<readonly string[]> =>
  (await appSettingService.getSetting("mail.allowlist")) ?? fromEnv;

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
      return config.production ? resend : withAllowlist(resend, settingsAllowlist(config.allowlist));
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
