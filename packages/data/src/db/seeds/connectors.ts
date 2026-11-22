import { eq } from "drizzle-orm";
import { getDb } from "../client";
import { careGroupSchema } from "../schema";
import { DEV_GROUP_ID } from "./careGroups";

// Connectors (connectors PRD): Dev Family allows assistants, so the
// /connect flow can be tried locally; Dev Family 2 and the other groups keep
// the default (off). No grants are seeded: connecting makes them.
export const seed = async () => {
  await getDb()
    .update(careGroupSchema)
    .set({ connectorsEnabled: true })
    .where(eq(careGroupSchema.id, DEV_GROUP_ID));
};
