import type { Route } from "./+types/route";

import { Form } from "react-router";
import { listDevMail, requireDevMail } from "~/.server/notifications";
import { Button, EmptyState, Field, LINK, List, ListRow } from "~/components/ui/plain";

// The dev mailbox (web only, 404 in production): what the `log` sender
// "sent", newest first. Filter with ?to=<email>.
export const meta = () => [{ title: "Dev mailbox · Caretook" }, { name: "robots", content: "noindex" }];

export const loader = async ({ request }: Route.LoaderArgs) => {
  requireDevMail();
  const to = new URL(request.url).searchParams.get("to")?.trim() || undefined;
  const messages = await listDevMail({ to, limit: 100 });
  return { to, messages: messages.map(({ html: _html, text: _text, ...rest }) => rest) };
};

export default function DevMailList({ loaderData: { to, messages } }: Route.ComponentProps) {
  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">Dev mailbox</h1>
      <p className="text-muted mt-1 text-sm">
        Email the <code>log</code> sender stored instead of sending. JSON at{" "}
        <a className={LINK} href="/dev/mail.json">
          /dev/mail.json
        </a>
        .
      </p>
      <Form method="get" className="mt-4 flex gap-2">
        <Field label="Recipient" labelHidden kind="input" className="grow">
          {(control) => (
            <input
              {...control}
              className={`${control.className} input-sm`}
              type="email"
              name="to"
              placeholder="Filter by recipient"
              defaultValue={to ?? ""}
            />
          )}
        </Field>
        <Button size="sm" type="submit">
          Filter
        </Button>
        {to && (
          <Button size="sm" variant="ghost" to="/dev/mail">
            Clear
          </Button>
        )}
      </Form>
      {messages.length === 0 ? (
        <EmptyState className="mt-6">No mail yet.</EmptyState>
      ) : (
        <List className="mt-4" data-dev-mail-list="">
          {messages.map((m) => (
            <ListRow key={m.id} to={`/dev/mail/${m.id}`}>
              <span className="block font-medium">{m.subject}</span>
              <span className="text-muted block text-sm">
                {m.to} · {m.name} · {new Date(m.createdAt).toLocaleString()}
              </span>
            </ListRow>
          ))}
        </List>
      )}
    </main>
  );
}
