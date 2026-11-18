import { migrate } from "../src/db/migrate";
import { run } from "./run";

await run("Database migrated", migrate);
