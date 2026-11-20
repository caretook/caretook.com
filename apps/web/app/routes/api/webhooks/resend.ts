import type { Route } from "./+types/resend";

import { handleResendWebhook } from "~/.server/notifications";

// Resend's bounce and complaint webhook (web only; hosting PRD). Resend
// POSTs Svix-signed events; the handler verifies them with
// RESEND_WEBHOOK_SECRET (401 otherwise) and suppresses hard-bounced and
// complaining addresses. Not under /rpc, so no CSRF or origin check: the
// signature is the check. Only POST: a GET has no loader to answer it.
export const action = ({ request }: Route.ActionArgs) => handleResendWebhook(request);
