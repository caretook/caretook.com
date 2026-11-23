import { AdminPager } from "../AdminPager";
import { AdminCard } from "../AdminCard";
import type { Route } from "./+types/route";

import { Form, Link } from "react-router";
import { requireStaff } from "~/.server/admin";
import { Badge, Button, CheckField, Field, LINK, List, ListRow } from "~/components/ui";
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
    <AdminCard id="groups" level={1} title="Care groups">
      <Form
        method="get"
        className="grid items-end gap-x-4 sm:grid-cols-[1fr_auto_auto]"
        data-group-filters=""
      >
        <Field kind="input" label="Group or recipient" help="Part of a group's or care recipient's name.">
          {(control) => (
            <input {...control} type="search" name="q" defaultValue={filter.q} maxLength={GROUP_QUERY_MAX} />
          )}
        </Field>
        <CheckField
          label="No owner"
          name="noOwner"
          value="1"
          defaultChecked={!!filter.noOwner}
          className="mb-6 sm:mb-8"
        />
        <div className="mb-6 flex gap-2 sm:mb-8">
          <Button type="submit" variant="primary">
            Search
          </Button>
          {hasGroupFilters(filter) && (
            <Button to={adminUrls.groups()} variant="ghost">
              Clear
            </Button>
          )}
        </div>
      </Form>

      <p role="status" className="text-sm" data-group-count={count}>
        {hasGroupFilters(filter)
          ? `${countText(count, "group", "groups")} ${count === 1 ? "matches" : "match"}.`
          : `${countText(count, "group", "groups")}.`}
      </p>

      {groups.length > 0 && (
        <List data-groups="">
          {groups.map((g) => (
            <ListRow key={g.id} className="space-y-1 text-sm" data-group={g.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <Link to={adminUrls.group(g.id)} className={`${LINK} font-medium`}>
                  {g.name}
                </Link>
                <span className="text-muted text-xs">Created {dayText(g.createdAt)}</span>
              </div>
              <p>
                For {recipientLabel(g)} · {countText(g.memberCount, "member", "members")}
              </p>
              <p data-owners={g.owners.length}>
                {g.owners.length === 0 ? (
                  <Badge tone="warning">No owner</Badge>
                ) : (
                  <>
                    {g.owners.length === 1 ? "Owner: " : "Owners: "}
                    {g.owners.map((o) => personLabel(o)).join(", ")}
                  </>
                )}
              </p>
            </ListRow>
          ))}
        </List>
      )}

      <AdminPager
        label="Group pages"
        page={page}
        pages={pages}
        to={(n) => adminUrls.groups(groupSearch(filter, n))}
      />
    </AdminCard>
  );
}
