import { describe, expect, it } from "vitest";
// The app's own builders (pure, no React): the links must be the paths the app routes.
import { appUrls } from "../../../../apps/web/app/lib/app-shell/appUrls";
import { entryPath, linkTo, passLogPath, profilePath, taskPath } from "./links";

const GROUP = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";
const ID = "5c1d6a2e-1b3f-4c5d-8e9f-0a1b2c3d4e5f";

describe("connector links", () => {
  it("are the app's paths for entries, pass rounds and tasks", () => {
    expect(entryPath(GROUP, { id: ID, kind: "note" })).toBe(appUrls.entry(GROUP, ID));
    expect(entryPath(GROUP, { id: ID, kind: "event" })).toBe(appUrls.entry(GROUP, ID));
    for (const kind of ["vital", "symptom", "dose"])
      expect(entryPath(GROUP, { id: ID, kind })).toBe(appUrls.editSheet(GROUP, ID));
    expect(passLogPath(GROUP, ID)).toBe(appUrls.passSheet(GROUP, ID));
    expect(taskPath(GROUP, ID)).toBe(appUrls.task(GROUP, ID));
    expect(profilePath(GROUP)).toBe(appUrls.profile(GROUP));
  });

  it("sit on our origin", () => {
    expect(linkTo("https://caretook.example", taskPath(GROUP, ID))).toBe(
      `https://caretook.example/app/groups/${GROUP}/tasks/${ID}`,
    );
    expect(linkTo(undefined, "/app")).toBe("/app");
  });
});
