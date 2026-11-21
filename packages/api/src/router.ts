import { admin } from "./admin/admin";
import { announcement } from "./admin/announcement";
import { calendars } from "./calendars/calendars";
import { accessCode } from "./care-groups/groups";
import { careGroup } from "./care-groups/careGroup";
import { connector } from "./connectors/connector";
import { invite } from "./care-groups/invites";
import { joinRequest } from "./care-groups/joinRequests";
import { me } from "./app-shell/me";
import { publicForms } from "./marketing/publicForms";
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
  connector,
  calendars,
};
export type Router = typeof router;
