import type { DeviceRoute } from "../../../../../test/device";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { appUrls } from "~/lib/app-shell/appUrls";
import { SETUP_NUDGE_FOLLOW_UP_MS } from "~/lib/app-shell/setupNudges";
import { renderWithDevice } from "../../../../../test/device";
import { forgetShownNudges } from "./useSetupNudges";
import { fixClock } from "../../../../../test/found";
import { Link } from "react-router";
import { fx, TEST_GROUP, TEST_USER } from "../../../../../test/fixtures";

// The setup nudges over the group's pages (the group layout's
// `useSetupNudges`), on the offline test device with a fake clock: the help
// nudge once the setup pages were opened, Don't ask again retiring it
// (pending, offline) and the entry nudge following 30 s later, whose Open
// lands on a new note. The default test device (every nudge retired) shows
// none. The pages under the group are stand-ins; the scheduler's rules are
// its unit test's. A shown nudge goes with its group (switching groups) and
// with its eligibility (a setup page opened), so its Open never points at a
// page that no longer applies.

const ROUTES: DeviceRoute[] = [
  { path: "/app/groups/:groupId/timeline", module: { default: () => <p>Timeline page</p> } },
  { path: "/app/groups/:groupId/entries/:entryId", module: { default: () => <p>Entry page</p> } },
];
const TIMELINE = appUrls.timeline(TEST_GROUP.id);

/** A second group, Grandpa Lou's, where the user is a caretaker: not its setter, so no setup page or nudge of its own. */
const LOU = { id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1b02", recipient: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1c02" };
const louGroup = [
  fx.group({ id: LOU.id, name: "Moreno Family 2" }),
  fx.recipient({ id: LOU.recipient, groupId: LOU.id, name: "Lou Moreno", preferredName: "Grandpa Lou" }),
  fx.member({ userId: TEST_USER.id, groupId: LOU.id, role: "caretaker" }),
];
/** The timeline stand-in with links to another group and to a setup page, as the header and settings give. */
const LINKED_ROUTES: DeviceRoute[] = [
  {
    path: "/app/groups/:groupId/timeline",
    module: {
      default: () => (
        <>
          <p>Timeline page</p>
          <Link to={appUrls.timeline(LOU.id)}>Grandpa Lou</Link>
          <Link to={appUrls.setup(TEST_GROUP.id, "providers")}>Set up providers</Link>
        </>
      ),
    },
  },
  { path: "/app/groups/:groupId/setup/:step", module: { default: () => <p>Setup page</p> } },
];

/** This device knows the account's settings: the server answered before, with the setup pages opened. */
const knownSettings = () => {
  localStorage.setItem(
    `caretook:settings:${TEST_USER.id}`,
    JSON.stringify({ groupSetup: { [TEST_GROUP.id]: { opened: true } } }),
  );
  localStorage.setItem(`caretook:settings:${TEST_USER.id}:known`, "true");
};
const pendingRetired = () =>
  (
    JSON.parse(localStorage.getItem(`caretook:settings-pending:${TEST_USER.id}`) ?? "null") as {
      groupSetup?: Record<string, { retired?: string[] }>;
    } | null
  )?.groupSetup?.[TEST_GROUP.id]?.retired ?? [];
const nudge = (name: string) => page.getByRole("alertdialog", { name });
const anyNudge = () => document.querySelector("[data-setup-nudge]");

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  forgetShownNudges();
});
afterEach(() => vi.restoreAllMocks());

describe("the setup nudges", () => {
  test("help shows once opened; Don't ask again retires it, and the entry nudge follows 30 s later", async () => {
    fixClock();
    knownSettings();
    const device = await renderWithDevice({ route: ROUTES, url: TIMELINE, noSetupRecord: true });
    const help = nudge("Want help onboarding?");
    await expect.element(help).toBeVisible();
    expect(
      help
        .getByRole("button")
        .elements()
        .map((b) => b.textContent?.trim() || b.ariaLabel),
    ).toEqual(["Open", "Don't ask again", "Dismiss"]);

    await userEvent.click(help.getByRole("button", { name: "Don't ask again" }));
    await expect.element(help).not.toBeInTheDocument();
    await expect.poll(pendingRetired).toEqual(["help"]);
    expect(anyNudge()).toBeNull();

    vi.advanceTimersByTime(SETUP_NUDGE_FOLLOW_UP_MS);
    const entry = nudge("Log a first entry on the timeline?");
    await expect.element(entry).toBeVisible();
    await userEvent.click(entry.getByRole("button", { name: "Open" }));
    await expect.poll(device.location).toBe(appUrls.newEntry(TEST_GROUP.id, "note"));
    await expect.element(page.getByText("Entry page")).toBeVisible();
  });

  test("help's Open goes to the first unfinished setup page", async () => {
    knownSettings();
    const device = await renderWithDevice({
      route: [
        ...ROUTES,
        { path: "/app/groups/:groupId/setup/:step", module: { default: () => <p>Setup</p> } },
      ],
      url: TIMELINE,
      noSetupRecord: true,
    });
    const help = nudge("Want help onboarding?");
    await userEvent.click(help.getByRole("button", { name: "Open" }));
    await expect.poll(device.location).toBe(appUrls.setup(TEST_GROUP.id, "providers"));
    await expect.element(help).not.toBeInTheDocument();
  });

  test("with storage refusing writes, the session's first nudge shows once, not again and again", async () => {
    knownSettings();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    });
    const device = await renderWithDevice({ route: ROUTES, url: TIMELINE, noSetupRecord: true });
    const help = nudge("Want help onboarding?");
    await expect.element(help).toBeVisible();
    // A repeat would wait behind it in the queue and show as soon as it goes.
    await userEvent.click(help.getByRole("button", { name: "Dismiss" }));
    await expect.element(help).not.toBeInTheDocument();
    await device.settle();
    expect(anyNudge()).toBeNull();
  });

  test("a shown nudge goes when another group opens", async () => {
    knownSettings();
    const device = await renderWithDevice({
      route: LINKED_ROUTES,
      url: TIMELINE,
      noSetupRecord: true,
      fixtures: louGroup,
    });
    const help = nudge("Want help onboarding?");
    await expect.element(help).toBeVisible();
    await userEvent.click(page.getByRole("link", { name: "Grandpa Lou" }));
    await expect.poll(device.location).toBe(appUrls.timeline(LOU.id));
    await expect.element(help).not.toBeInTheDocument();
    await device.settle();
    expect(anyNudge()).toBeNull();
  });

  test("a shown nudge goes when a setup page opens", async () => {
    knownSettings();
    const device = await renderWithDevice({ route: LINKED_ROUTES, url: TIMELINE, noSetupRecord: true });
    const help = nudge("Want help onboarding?");
    await expect.element(help).toBeVisible();
    await userEvent.click(page.getByRole("link", { name: "Set up providers" }));
    await expect.element(page.getByText("Setup page")).toBeVisible();
    await expect.poll(device.location).toBe(appUrls.setup(TEST_GROUP.id, "providers"));
    await expect.element(help).not.toBeInTheDocument();
    await device.settle();
    expect(anyNudge()).toBeNull();
  });

  test("the default test device shows no nudge", async () => {
    knownSettings();
    await renderWithDevice({ route: ROUTES, url: TIMELINE });
    await expect.element(page.getByText("Timeline page")).toBeVisible();
    expect(anyNudge()).toBeNull();
  });
});
