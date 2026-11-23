import { AdminPager } from "../AdminPager";
import { AdminCard } from "../AdminCard";
import type { Route } from "./+types/route";

import { Form, Link } from "react-router";
import { requireStaff } from "~/.server/admin";
import { Button, Field, LINK, List, ListRow } from "~/components/ui";
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
    <AdminCard id="users" level={1} title="Users">
      <Form method="get" className="flex flex-wrap items-end gap-2" data-user-search="">
        <Field kind="input" label="Name or email" help="Part of either is enough." className="min-w-0 flex-1">
          {(control) => <input {...control} type="search" name="q" defaultValue={q} maxLength={MAX_QUERY} />}
        </Field>
        <Button type="submit" variant="primary" className="mb-1">
          Search
        </Button>
      </Form>
      <p role="status" className="text-sm" data-user-count={count}>
        {q ? `${accounts(count)} ${count === 1 ? "matches" : "match"}.` : `${accounts(count)}.`}
      </p>
      {users.length > 0 && (
        <List data-users="">
          {users.map((user) => (
            <ListRow key={user.id} data-user={user.email}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <Link to={adminUrls.user(user.id)} className={`${LINK} font-medium break-all`}>
                  {user.name || user.email}
                </Link>
                <span className="text-muted text-xs">Joined {adminDay(user.createdAt)}</span>
              </div>
              {user.name && <p className="text-muted text-sm break-all">{user.email}</p>}
              <p className="mt-1">
                <AccountBadges account={user} />
              </p>
            </ListRow>
          ))}
        </List>
      )}
      <AdminPager
        label="Account pages"
        page={page}
        pages={pages}
        to={(n) => adminUrls.users(userSearch(q, n))}
      />
    </AdminCard>
  );
}
