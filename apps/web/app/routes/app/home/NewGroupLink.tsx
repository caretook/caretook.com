import { Plus } from "lucide-react";
import { Button } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { NEW_GROUP_LINK_STATE } from "~/lib/care-groups/newGroupLink";

// "New care group" on /app's list: opens the sheet that starts one.
export function NewGroupLink() {
  return (
    <Button to={appUrls.newGroup()} state={NEW_GROUP_LINK_STATE} size="sm" icon={Plus} data-new-group-link="">
      New care group
    </Button>
  );
}
