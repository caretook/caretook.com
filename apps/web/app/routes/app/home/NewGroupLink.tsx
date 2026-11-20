import { Plus } from "lucide-react";
import { Link } from "react-router";
import { appUrls } from "~/lib/app-shell/appUrls";
import { NEW_GROUP_LINK_STATE } from "~/lib/care-groups/newGroupLink";

// "New care group" on /app's list: opens the sheet that starts one.
export function NewGroupLink() {
  return (
    <Link
      to={appUrls.newGroup()}
      state={NEW_GROUP_LINK_STATE}
      className="btn btn-outline btn-sm"
      data-new-group-link=""
    >
      <Plus aria-hidden="true" className="size-4" />
      New care group
    </Link>
  );
}
