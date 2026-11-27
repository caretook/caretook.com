// The test zones, in one place. CI's primary jobs run in PRIMARY_ZONE; the release
// tier's second-zone jobs set CARETOOK_TEST_ZONE (`node scripts/ci/env.mjs zone`),
// which the component tests, the Playwright config and its fixtures read, and TZ,
// which the server reads. Node's own modules only: the verdict job has no install.

export const PRIMARY_ZONE = "America/Los_Angeles";
export const SECOND_ZONE = "America/New_York";

/**
 * What second-zone failures do to a verdict. `report`: they can't fail it and are
 * filed (`risa ci zone-file`). `block`: they count like any other failure.
 * @type {"report" | "block"}
 */
export const SECOND_ZONE_MODE = "report";

/** The zone this process's tests run in. */
export const testZone = (env = process.env) => env.CARETOOK_TEST_ZONE || PRIMARY_ZONE;

/** The env lines that move a job to the second zone. */
export const secondZoneEnv = () => ({ CARETOOK_TEST_ZONE: SECOND_ZONE, TZ: SECOND_ZONE });
