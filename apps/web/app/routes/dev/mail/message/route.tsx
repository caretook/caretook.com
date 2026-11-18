import type { Route } from "./+types/route";

import { Link } from "react-router";
import { getDevMail, requireDevMail } from "~/.server/notifications";

// One message in the dev mailbox: its links, the HTML (in a sandboxed
// frame, scripts off) and the plain text. 404 in production.
export const meta = ({ loaderData }: Route.MetaArgs) => [
  { title: `${loaderData?.message.subject ?? "Message"} · Dev mailbox` },
  { name: "robots", content: "noindex" },
];

export const loader = async ({ params }: Route.LoaderArgs) => {
  requireDevMail();
  const message = await getDevMail(params.id);
  if (!message) throw new Response("Not found", { status: 404 });
  return { message };
};

export default function DevMailMessage({ loaderData: { message } }: Route.ComponentProps) {
  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-6" data-dev-mail-message={message.id}>
      <Link className="link text-sm" to="/dev/mail">
        ← Dev mailbox
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">{message.subject}</h1>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 text-sm">
        <dt className="opacity-70">To</dt>
        <dd>{message.to}</dd>
        <dt className="opacity-70">From</dt>
        <dd>{message.from}</dd>
        <dt className="opacity-70">Notification</dt>
        <dd>{message.name}</dd>
        <dt className="opacity-70">Stored</dt>
        <dd>{new Date(message.createdAt).toLocaleString()}</dd>
      </dl>

      <h2 className="mt-6 font-semibold">Links</h2>
      {message.links.length ? (
        <ul className="mt-1 list-disc pl-5 text-sm" data-dev-mail-links>
          {message.links.map((href) => (
            <li key={href}>
              <a className="link break-all" href={href}>
                {href}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm">None.</p>
      )}

      <h2 className="mt-6 font-semibold">HTML</h2>
      <iframe
        title="The email's HTML"
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        srcDoc={message.html}
        className="mt-1 h-[28rem] w-full rounded-box border border-base-300 bg-white"
      />

      <h2 className="mt-6 font-semibold">Plain text</h2>
      <pre className="mt-1 whitespace-pre-wrap rounded-box bg-base-100 p-3 text-sm" data-dev-mail-text>
        {message.text}
      </pre>
    </main>
  );
}
