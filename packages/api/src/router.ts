import { admin } from "./admin/admin";
import { announcement } from "./announcement/announcement";
import { accessCode } from "./care-groups/groups";
import { careGroup } from "./care-groups/careGroup";
import { invite } from "./care-groups/invites";
import { joinRequest } from "./care-groups/joinRequests";
import { me } from "./me/me";
import { publicForms } from "./public-forms/publicForms";
import { search } from "./search/search";
import { sync } from "./sync";
import { timeline } from "./timeline/timeline";

export const router = {
  me,
  careGroup,
  timeline,
  sync,
  invite,
  joinRequest,
  accessCode,
  admin,
  public: { ...publicForms, announcement },
  search,
};
export type Router = typeof router;
