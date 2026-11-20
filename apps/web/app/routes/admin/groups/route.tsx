import type { Route } from "./+types/route";

import { Form, Link } from "react-router";
import { requireStaff } from "~/.server/admin";
import { Field } from "~/components/ui";
import { adminUrls } from "../adminUrls";
import { countText, dayText, personLabel, recipientLabel } from "../groupDisplay";
import {
  GROUP_QUERY_MAX,
  groupPageCount,
  groupSearch,
  hasGroupFilters,
  parseGroupSearch,
} from "./groupFilters";

// /admin/groups (admin slice 4): care groups by group or recipient name,
// newest first, 50 a page, with members, owners and created date, and a "No
// owner" filter for groups that need an owner recovered. Every staff member
// reads it; nothing here is care data.

export const meta = () => [{ title: "Groups · Caretook admin" }, { name: "robots", content: "noindex" }];

export async function loader({ request }: Route.LoaderArgs) {
  const { api } = await requireStaff(request, "groups.read");
  const { filter, page } = parseGroupSearch(new URL(request.url).search);
  const result = await api.admin.groups.search({ ...filter, page });
  return { ...result, filter, pages: groupPageCount(result.count, result.pageSize) };
}

export default function Groups({ loaderData }: Route.ComponentProps) {
  const { filter, count, page, pages, groups } = loaderData;
  return (
    <section className="card bg-base-100 shadow-sm" aria-labelledby="groups">
      <div className="card-body gap-4">
        <h1 id="groups" className="card-title">
          Care groups
        </h1>
        <Form
          method="get"
          className="grid items-end gap-x-4 sm:grid-cols-[1fr_auto_auto]"
          data-group-filters=""
        >
          <Field label="Group or recipient" help="Part of a group's or care recipient's name.">
            {(control) => (
              <input
                {...control}
                type="search"
                name="q"
                defaultValue={filter.q}
                maxLength={GROUP_QUERY_MAX}
                className="input w-full"
              />
            )}
          </Field>
          <label className="label mb-6 gap-2 sm:mb-8">
            <input
              type="checkbox"
              name="noOwner"
              value="1"
              defaultChecked={!!filter.noOwner}
              className="checkbox checkbox-sm"
            />
            No owner
          </label>
          <div className="mb-6 flex gap-2 sm:mb-8">
            <button type="submit" className="btn btn-primary">
              Search
            </button>
            {hasGroupFilters(filter) && (
              <Link to={adminUrls.groups()} className="btn btn-ghost">
                Clear
              </Link>
            )}
          </div>
        </Form>

        <p role="status" className="text-sm" data-group-count={count}>
          {hasGroupFilters(filter)
            ? `${countText(count, "group", "groups")} ${count === 1 ? "matches" : "match"}.`
            : `${countText(count, "group", "groups")}.`}
        </p>

        {groups.length > 0 && (
          <ul className="divide-base-300 divide-y" data-groups="">
            {groups.map((g) => (
              <li key={g.id} className="space-y-1 py-3 text-sm" data-group={g.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <Link to={adminUrls.group(g.id)} className="link font-medium">
                    {g.name}
                  </Link>
                  <span className="text-base-content/70 text-xs">Created {dayText(g.createdAt)}</span>
                </div>
                <p>
                  For {recipientLabel(g)} · {countText(g.memberCount, "member", "members")}
                </p>
                <p data-owners={g.owners.length}>
                  {g.owners.length === 0 ? (
                    <span className="badge badge-warning badge-sm">No owner</span>
                  ) : (
                    <>
                      {g.owners.length === 1 ? "Owner: " : "Owners: "}
                      {g.owners.map((o) => personLabel(o)).join(", ")}
                    </>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}

        {pages > 1 && (
          <nav aria-label="Group pages" className="flex items-center justify-between gap-2 text-sm">
            {page > 1 ? (
              <Link className="btn btn-sm" to={adminUrls.groups(groupSearch(filter, page - 1))}>
                Newer
              </Link>
            ) : (
              <span />
            )}
            <span>
              Page {page} of {pages}
            </span>
            {page < pages ? (
              <Link className="btn btn-sm" to={adminUrls.groups(groupSearch(filter, page + 1))}>
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
