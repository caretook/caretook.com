import type { ApiOutputs } from "~/lib/core/rpc";
import type { DeviceOptions, DeviceRoute } from "../../../test/device";

import { adminFx, capabilitiesOf } from "../../../test/adminFixtures";
import { renderWithDevice } from "../../../test/device";
import * as layout from "./layout/route";

// /admin's component tests (web only: server loaders, so every page renders
// from `loaderData`): the real admin layout (nav by capability) around the
// page under test, as an admin or support. Pages' builders: adminFx
// (test/adminFixtures.ts).

export type StaffRole = "admin" | "support";

/** The admin layout with `routes` inside, at `url`, as `staff` (default admin). */
export const openAdmin = ({
  staff = "admin",
  routes,
  url,
  ...options
}: { staff?: StaffRole; routes: DeviceRoute | DeviceRoute[]; url: string } & Omit<
  DeviceOptions,
  "route" | "url" | "element"
>) =>
  renderWithDevice({
    route: {
      path: "/admin",
      id: "admin",
      module: layout,
      loaderData: { capabilities: capabilitiesOf(staff) },
      children: [routes].flat(),
    },
    url,
    // Staff are in no care group.
    role: null,
    ...options,
  });

/** An action's answers by intent, recording what each post sent. */
export const postedForms = (answer: (form: FormData) => unknown) => {
  const posts: Record<string, string>[] = [];
  return {
    posts,
    actionResult: (form: FormData) => {
      posts.push(
        Object.fromEntries([...form.entries()].map(([k, v]) => [k, typeof v === "string" ? v : v.name])),
      );
      return answer(form);
    },
  };
};

type AccountPageData = {
  page: ApiOutputs["admin"]["users"]["get"];
  groupLimit: ApiOutputs["admin"]["users"]["groupLimit"];
  canHelp: boolean;
  canDisable: boolean;
  canSetRole: boolean;
  canSetLimit: boolean;
  isSelf: boolean;
  history: { count: number; entries: ReturnType<typeof adminFx.auditEntry>[] } | null;
};

/**
 * The account page's loader data (/admin/users/:userId) for `page`, as an
 * admin sees it: every control, `admin.users.groupLimit`'s answer
 * (adminFx.groupLimit) and no audit entries, unless `v` says otherwise.
 */
export const accountPageData = (
  page: AccountPageData["page"],
  v: Partial<Omit<AccountPageData, "page">> = {},
): AccountPageData => ({
  page,
  groupLimit: adminFx.groupLimit(),
  canHelp: true,
  canDisable: true,
  canSetRole: true,
  canSetLimit: true,
  isSelf: false,
  history: null,
  ...v,
});
