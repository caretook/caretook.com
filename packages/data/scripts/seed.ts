import { seed } from "../src/db/seeds";
import { run } from "./run";

await run("Database seeded", seed);
