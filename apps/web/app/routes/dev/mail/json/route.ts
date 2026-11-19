import type { Route } from "./+types/route";

import { getDevMail, listDevMail, requireDevMail } from "~/.server/notifications";

// The dev mailbox as JSON, for browser checks and scripts (404 in production):
//   /dev/mail.json?to=<email>&limit=<n>   newest first
//   /dev/mail.json?id=<id>                one message
// Each message has id, name, from, to, subject, html, text, links, createdAt.
export const loader = async ({ request }: Route.LoaderArgs) => {
  requireDevMail();
  const params = new URL(request.url).searchParams;
  const headers = { "cache-control": "no-store" };

  const id = params.get("id");
  if (id) {
    const message = await getDevMail(id);
    return message
      ? Response.json(message, { headers })
      : Response.json({ error: "Not found" }, { status: 404, headers });
  }
  const messages = await listDevMail({
    to: params.get("to") ?? undefined,
    limit: Number(params.get("limit")) || 50,
  });
  return Response.json({ messages }, { headers });
};
