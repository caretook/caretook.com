import type { Route } from "./+types/route";

import { Form, Link } from "react-router";
import { listDevMail, requireDevMail } from "~/.server/notifications";

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
      <p className="mt-1 text-sm opacity-70">
        Email the <code>log</code> sender stored instead of sending. JSON at{" "}
        <a className="link" href="/dev/mail.json">
          /dev/mail.json
        </a>
        .
      </p>
      <Form method="get" className="mt-4 flex gap-2">
        <label className="input input-sm grow">
          <span className="sr-only">Recipient</span>
          <input type="email" name="to" placeholder="Filter by recipient" defaultValue={to ?? ""} />
        </label>
        <button className="btn btn-sm" type="submit">
          Filter
        </button>
        {to && (
          <Link className="btn btn-sm btn-ghost" to="/dev/mail">
            Clear
          </Link>
        )}
      </Form>
      {messages.length === 0 ? (
        <p className="mt-6">No mail yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-base-300 rounded-box bg-base-100" data-dev-mail-list>
          {messages.map((m) => (
            <li key={m.id}>
              <Link className="block p-3 hover:bg-base-200" to={`/dev/mail/${m.id}`}>
                <span className="block font-medium">{m.subject}</span>
                <span className="block text-sm opacity-70">
                  {m.to} · {m.name} · {new Date(m.createdAt).toLocaleString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
