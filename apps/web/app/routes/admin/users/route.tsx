import type { Route } from "./+types/route";

import { Form, Link } from "react-router";
import { requireStaff } from "~/.server/admin";
import { Field } from "~/components/ui";
import { AccountBadges } from "../AccountBadges";
import { adminDay } from "../accountDisplay";
import { adminUrls } from "../adminUrls";
import { MAX_QUERY, parseUserSearch, userPageCount, userSearch } from "./userSearch";

// /admin/users (admin PRD, slice 2): every account, newest first, 50 a page,
// searched by part of a name or email (in the URL). Each opens the account's
// page. Every staff member may search.

export const meta = () => [{ title: "Users · Caretook admin" }, { name: "robots", content: "noindex" }];

export async function loader({ request }: Route.LoaderArgs) {
  const { api } = await requireStaff(request, "users.read");
  const { q, page } = parseUserSearch(new URL(request.url).search);
  const result = await api.admin.users.search({ ...(q ? { q } : {}), page });
  return { ...result, q, pages: userPageCount(result.count, result.pageSize) };
}

const accounts = (n: number) => `${n.toLocaleString("en-US")} ${n === 1 ? "account" : "accounts"}`;

export default function Users({ loaderData }: Route.ComponentProps) {
  const { q, count, page, pages, users } = loaderData;
  return (
    <section className="card bg-base-100 shadow-sm" aria-labelledby="users">
      <div className="card-body gap-4">
        <h1 id="users" className="card-title">
          Users
        </h1>
        <Form method="get" className="flex flex-wrap items-end gap-2" data-user-search="">
          <Field label="Name or email" help="Part of either is enough." className="min-w-0 flex-1">
            {(control) => (
              <input
                {...control}
                type="search"
                name="q"
                defaultValue={q}
                maxLength={MAX_QUERY}
                className="input w-full"
              />
            )}
          </Field>
          <button type="submit" className="btn btn-primary mb-1">
            Search
          </button>
        </Form>
        <p role="status" className="text-sm" data-user-count={count}>
          {q ? `${accounts(count)} ${count === 1 ? "matches" : "match"}.` : `${accounts(count)}.`}
        </p>
        {users.length > 0 && (
          <ul className="divide-base-300 divide-y" data-users="">
            {users.map((user) => (
              <li key={user.id} className="py-3" data-user={user.email}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <Link to={adminUrls.user(user.id)} className="link font-medium break-all">
                    {user.name || user.email}
                  </Link>
                  <span className="text-base-content/70 text-xs">Joined {adminDay(user.createdAt)}</span>
                </div>
                {user.name && <p className="text-base-content/80 text-sm break-all">{user.email}</p>}
                <p className="mt-1">
                  <AccountBadges account={user} />
                </p>
              </li>
            ))}
          </ul>
        )}
        {pages > 1 && (
          <nav aria-label="Account pages" className="flex items-center justify-between gap-2 text-sm">
            {page > 1 ? (
              <Link className="btn btn-sm" to={adminUrls.users(userSearch(q, page - 1))}>
                Newer
              </Link>
            ) : (
              <span />
            )}
            <span>
              Page {page} of {pages}
            </span>
            {page < pages ? (
              <Link className="btn btn-sm" to={adminUrls.users(userSearch(q, page + 1))}>
                Older
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>
    </section>
  );
}
