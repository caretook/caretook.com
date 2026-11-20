import { useEffect, useState } from "react";
import { describe, expect, test } from "vitest";
import { useGroup } from "~/lib/group";
import { parseSearch } from "@caretook/data/schema";
import { searchEntryIds, searchIndexStatus } from "~/lib/sync/search";
import { createEntry, removeEntry } from "~/lib/sync/timeline";
import * as timeline from "~/routes/app/groups/timeline/route";
import { renderWithDevice } from "./device";
import { fx, TEST_GROUP } from "./fixtures";

// The test device's own tests: what every component test leans on.

const TIMELINE = { path: "/app/groups/:groupId/timeline", module: timeline };
const timelineUrl = `/app/groups/${TEST_GROUP.id}/timeline`;

/** A screen that never settles: it changes on every frame. */
function Ticker() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setN(n + 1));
    return () => cancelAnimationFrame(id);
  }, [n]);
  return <p>Frame {n}</p>;
}

function GroupLine() {
  const group = useGroup();
  return (
    <p>
      {group.displayName} · {group.role} · {group.canWrite ? "writer" : "reader"}
    </p>
  );
}

describe("the test device", () => {
  test("fixtures render on a real route: entries of several kinds, a document's text, a co-member", async () => {
    const sam = fx.person({ name: "Sam Okafor", role: "caretaker" });
    const lisinopril = fx.medication();
    const device = await renderWithDevice({
      route: TIMELINE,
      url: timelineUrl,
      fixtures: [
        sam,
        lisinopril,
        fx.note({ text: "Slept through the night", createdBy: sam.id }),
        fx.symptom({ name: "Dizzy when standing", severity: 4 }),
        fx.vital({ readings: [{ type: "heartRate", value: 64 }] }),
        fx.dose({ medicationId: lisinopril.id }),
      ],
    });
    const { screen } = device;
    await expect.element(screen.getByText("Slept through the night")).toBeVisible();
    await expect.element(screen.getByText(/Dizzy when standing · 4/)).toBeVisible();
    await expect.element(screen.getByText("Lisinopril 10 mg").first()).toBeVisible();
    await expect
      .element(screen.getByRole("link", { name: "Show only Sam Okafor's entries" }))
      .toBeInTheDocument();
  });

  test("a local write updates a live query on screen, and queues an upload", async () => {
    const note = fx.note({ text: "Walked to the mailbox" });
    const device = await renderWithDevice({ route: TIMELINE, url: timelineUrl, fixtures: [note] });
    await expect.element(device.screen.getByText("Walked to the mailbox")).toBeVisible();

    const created = await createEntry(device.db, TEST_GROUP.id, {
      kind: "symptom",
      occurredAt: new Date().toISOString(),
      timeZone: "America/Los_Angeles",
      details: { name: "Sore knee", severity: 2 },
    });
    expect(created.ok).toBe(true);
    await expect.element(device.screen.getByText(/Sore knee/)).toBeVisible();

    await removeEntry(device.db, note.id);
    await expect.element(device.screen.getByText("Walked to the mailbox")).not.toBeInTheDocument();

    const queued = await device.queued();
    expect(queued.map((w) => [w.op, w.type])).toEqual([
      ["PUT", "timeline_entry"],
      ["PATCH", "timeline_entry"],
    ]);
  });

  test("rows syncing down from another device appear without a reload", async () => {
    const device = await renderWithDevice({ route: TIMELINE, url: timelineUrl });
    await device.sync(fx.note({ text: "Pharmacy called back" }));
    await expect.element(device.screen.getByText("Pharmacy called back")).toBeVisible();
  });

  test("a viewer and a writer see different controls", async () => {
    const owner = await renderWithDevice({ route: TIMELINE, url: timelineUrl, role: "owner" });
    await expect.element(owner.screen.getByRole("button", { name: "Add to timeline" })).toBeVisible();
    await owner.screen.unmount();

    const viewer = await renderWithDevice({ route: TIMELINE, url: timelineUrl, role: "viewer" });
    await expect.element(viewer.screen.getByRole("heading", { level: 1 })).toBeVisible();
    await expect
      .element(viewer.screen.getByRole("button", { name: "Add to timeline" }))
      .not.toBeInTheDocument();
  });

  test("the role and group reach useGroup()", async () => {
    const device = await renderWithDevice({ element: <GroupLine />, role: "viewer" });
    await expect.element(device.screen.getByText("Grandma June · viewer · reader")).toBeVisible();
  });

  test("a group the user isn't in is the 404", async () => {
    const device = await renderWithDevice({ route: TIMELINE, url: timelineUrl, role: null });
    await expect.element(device.screen.getByRole("heading", { name: "Not found" })).toBeVisible();
  });

  test("search: the device's search index is built over the fixtures", async () => {
    const note = fx.note({ text: "Walked to the mailbox" });
    const device = await renderWithDevice({
      element: <GroupLine />,
      fixtures: [note, fx.note({ text: "Ate lunch" })],
      search: true,
    });
    await expect.poll(searchIndexStatus).toBe("ready");
    await expect
      .poll(() => searchEntryIds(device.db, TEST_GROUP.id, parseSearch("mailbox")))
      .toEqual([note.id]);
  });

  test("frame: the real /app header and tab bar around the screen", async () => {
    const device = await renderWithDevice({ route: TIMELINE, url: timelineUrl, frame: true });
    await expect
      .element(device.screen.getByRole("button", { name: /Account menu for Alex Moreno/ }))
      .toBeVisible();
    await expect.element(device.screen.getByRole("button", { name: /switch care group/ })).toBeVisible();
    await expect
      .element(
        device.screen
          .getByRole("navigation", { name: "Group sections" })
          .getByRole("link", { name: "Timeline" }),
      )
      .toHaveAttribute("aria-current", "page");
  });

  test("width and theme apply", async () => {
    const light = await renderWithDevice({ element: <GroupLine />, width: 1280, theme: "light" });
    expect(document.documentElement.clientWidth).toBe(1280);
    const lightBg = getComputedStyle(document.body).backgroundColor;
    await light.screen.unmount();

    await renderWithDevice({ element: <GroupLine />, width: 420, theme: "dark" });
    expect(document.documentElement.clientWidth).toBe(420);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(getComputedStyle(document.body).backgroundColor).not.toBe(lightBg);
  });
});

describe("settle", () => {
  test("a stored write, then a read of the screen: missing straight after the write, there once settled", async () => {
    const device = await renderWithDevice({
      route: TIMELINE,
      url: timelineUrl,
      fixtures: [fx.note({ text: "Ate lunch" })],
    });
    await expect.element(device.screen.getByText("Ate lunch")).toBeVisible();
    await device.settle();

    await createEntry(device.db, TEST_GROUP.id, {
      kind: "symptom",
      occurredAt: new Date().toISOString(),
      timeZone: "America/Los_Angeles",
      details: { name: "Sore knee", severity: 2 },
    });
    // The race B-131 saw: the live query hasn't rerun yet (it's throttled).
    // The timeline shows a symptom in more than one place (the row, the day summary), so count them.
    expect(device.screen.getByText(/Sore knee/).elements()).toHaveLength(0);
    await device.settle();
    expect(device.screen.getByText(/Sore knee/).elements().length).toBeGreaterThan(0);
  });

  test("after sync() and unsync(): every live query on the screen has caught up, not just the first", async () => {
    const sam = fx.person({ name: "Sam Okafor", role: "caretaker" });
    const note = fx.note({ text: "Pharmacy called back", createdBy: sam.id });
    const device = await renderWithDevice({ route: TIMELINE, url: timelineUrl });
    await device.settle();

    await device.sync([sam, note]);
    expect(device.screen.getByText("Pharmacy called back").query()).toBeNull();
    await device.settle();
    expect(device.screen.getByText("Pharmacy called back").query()).not.toBeNull();
    expect(
      device.screen.getByRole("link", { name: "Show only Sam Okafor's entries" }).query(),
    ).not.toBeNull();

    await device.unsync([note]);
    await device.settle();
    expect(device.screen.getByText("Pharmacy called back").query()).toBeNull();
  });

  test("a screen that never stops changing: settle times out, saying why", async () => {
    const device = await renderWithDevice({ element: <Ticker />, settle: false });
    await expect.element(device.screen.getByText(/Frame \d+/)).toBeVisible();
    await expect(device.settle({ timeout: 300 })).rejects.toThrow(
      "settle: the screen didn't settle within 300 ms: the screen kept changing (the DOM changed in every frame).",
    );
  });
});
