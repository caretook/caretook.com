// Models own data access and enforce RBAC: every query is scoped by the
// acting user's permissions (see ../permissions). One folder per table:
//
//   models/<name>/<name>Model.ts   dbToModel, getWith, custom queries, CRUD from baseModel
//   models/<name>/types.ts         model types inferred from dbToModel
//   models/<name>/index.ts
import * as baseModel from "./base";
export { baseModel };
export type * from "./base/queryHelpers";

import * as userModel from "./user";
export { userModel };
export type * from "./user/types";
