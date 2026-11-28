import { useEffect, useState } from "react";
import { Form, useActionData, useLoaderData, useLocation } from "react-router";
import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { searchEntryIds, searchIndexStatus } from "~/lib/search/search.sync";
import { createEntry, removeEntry } from "~/lib/timeline/timeline.sync";
import { renderWithDevice } from "./device";
import { found, WAIT_TIMEOUT } from "./found";
import { getByCss } from "./locators";
import { fx, TEST_GROUP } from "./fixtures";
import { PROBE } from "./probe";
import { parseSearch } from "@caretook/data/domain";

// The test device's own tests: what every component test leans on, on the
// probe route (test/probe.tsx), never a real screen.

const url = `/app/groups/${TEST_GROUP.id}/probe`;
const open = (options: Parameters<typeof renderWithDevice>[0] = {}) =>
  renderWithDevice({ route: PROBE, url, ...options });
const SORE_KNEE = {
  kind: "symptom" as const,
  occurredAt: new Date().toISOString(),
  timeZone: "America/Los_Angeles",
  details: { name: "Sore knee", severity: 2 },
};

/** A screen that never settles: it changes on every frame. */
function Ticker() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setN(n + 1));
    return () => cancelAnimationFrame(id);
  }, [n]);
  return <p>Frame {n}</p>;
}

describe("the test device", () => {
  test("fixtures reach a route's live query: a document's text, a symptom, a co-member's entry", async () => {
    const sam = fx.person({ name: "Sam Okafor", role: "caretaker" });
    const { screen } = await open({
      fixtures: [
        sam,
        fx.note({ text: "Slept through the night", createdBy: sam.id }),
        fx.symptom({ name: "Dizzy when standing", severity: 4 }),
      ],
    });
    await expect.element(screen.getByText("Dizzy when standing")).toBeVisible();
    // A data- hook through getByCss, retried until it's there.
    await expect
      .element(getByCss('li[data-kind="note"]'))
      .toHaveTextContent("Slept through the night · by Sam Okafor");
  });

  test("a local write updates the screen and queues an upload; rows synced down appear without a reload", async () => {
    const note = fx.note({ text: "Walked to the mailbox" });
    const device = await open({ fixtures: [note] });
    await expect.element(device.screen.getByText("Walked to the mailbox")).toBeVisible();
    expect((await createEntry(device.db, TEST_GROUP.id, SORE_KNEE)).ok).toBe(true);
    await expect.element(device.screen.getByText("Sore knee")).toBeVisible();
    await removeEntry(device.db, note.id);
    await expect.element(device.screen.getByText("Walked to the mailbox")).not.toBeInTheDocument();
    // A new symptom name joins the group's catalog in the same write (symptom-catalog).
    expect((await device.queued()).map((w) => [w.op, w.type])).toEqual([
      ["PUT", "symptom_type"],
      ["PUT", "timeline_entry"],
      ["PATCH", "timeline_entry"],
    ]);

    await device.sync(fx.note({ text: "Pharmacy called back" }));
    await expect.element(device.screen.getByText("Pharmacy called back")).toBeVisible();
  });

  test.each([
    ["owner", "Grandma June · owner · writer", true],
    ["viewer", "Grandma June · viewer · reader", false],
  ] as const)(
    "as %s: the role reaches useGroup(), and the screen's writer controls follow",
    async (role, line, add) => {
      const { screen } = await open({ role });
      await expect.element(screen.getByText(line)).toBeVisible();
      expect(screen.getByRole("button", { name: "Add" }).query() !== null).toBe(add);
    },
  );

  test("a group the user isn't in is the 404", async () => {
    const { screen } = await open({ role: null });
    await expect.element(screen.getByRole("heading", { name: "Not found" })).toBeVisible();
  });

  test("search: the device's search index is built over the fixtures", async () => {
    const note = fx.note({ text: "Walked to the mailbox" });
    const device = await open({ fixtures: [note, fx.note({ text: "Ate lunch" })], search: true });
    await expect.poll(searchIndexStatus).toBe("ready");
    await expect
      .poll(() => searchEntryIds(device.db, TEST_GROUP.id, parseSearch("mailbox")))
      .toEqual([note.id]);
  });

  test("width and theme apply", async () => {
    const light = await open({ width: 1280, theme: "light" });
    expect(document.documentElement.clientWidth).toBe(1280);
    const lightBg = getComputedStyle(document.body).backgroundColor;
    await light.screen.unmount();
    await open({ width: 420, theme: "dark" });
    expect(document.documentElement.clientWidth).toBe(420);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(getComputedStyle(document.body).backgroundColor).not.toBe(lightBg);
  });
});

/** A web-only route as /admin's are: a server loader and action, which the device never runs. */
const serverRoute = {
  loader: () => {
    throw new Error("the server loader ran");
  },
  action: () => {
    throw new Error("the server action ran");
  },
  default: function Notes() {
    const { notes } = useLoaderData<{ notes: string[] }>();
    const result = useActionData<{ message: string }>();
    return (
      <>
        <p>{useLocation().pathname}</p>
        <ul>
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        <Form method="post">
          <input name="note" aria-label="Note" />
          <button type="submit">Add</button>
        </Form>
        {result && <p role="status">{result.message}</p>}
      </>
    );
  },
};

describe("server-loaded routes", () => {
  test("a server loader renders from loaderData, outside /app; an action gets actionResult, then it reloads", async () => {
    const notes = ["Called the pharmacy"];
    const device = await renderWithDevice({
      route: {
        path: "/admin/notes",
        module: serverRoute,
        loaderData: () => ({ notes: [...notes] }),
        actionResult: (form: FormData) => {
          notes.push(form.get("note") as string);
          return { message: `Added ${form.get("note") as string}.` };
        },
      },
      url: "/admin/notes",
    });
    await expect.element(device.screen.getByText("Called the pharmacy")).toBeVisible();
    expect(device.location()).toBe("/admin/notes");
    await userEvent.fill(device.screen.getByRole("textbox", { name: "Note" }), "Booked a ride");
    await userEvent.click(device.screen.getByRole("button", { name: "Add" }));
    await expect.element(device.screen.getByRole("status")).toHaveTextContent("Added Booked a ride.");
    // The action's revalidation asked loaderData again.
    await expect.element(device.screen.getByText("Booked a ride")).toBeVisible();
  });

  test("without loaderData, a server loader is an error naming what to give", async () => {
    const device = await renderWithDevice({
      route: { path: "/admin/notes", module: serverRoute },
      url: "/admin/notes",
      settle: false,
    });
    await expect
      .element(
        device.screen.getByRole("heading", {
          name: /\/admin\/notes has a server loader: give the route loaderData/,
        }),
      )
      .toBeInTheDocument();
  });
});

describe("settle", () => {
  test("a stored write: missing from the screen straight after it, there once settled", async () => {
    const device = await open({ fixtures: [fx.note({ text: "Ate lunch" })] });
    await expect.element(device.screen.getByText("Ate lunch")).toBeVisible();
    await device.settle();
    await createEntry(device.db, TEST_GROUP.id, SORE_KNEE);
    // The race B-131 saw: the live query hasn't rerun yet (it's throttled).
    expect(device.screen.getByText("Sore knee").query()).toBeNull();
    await device.settle();
    expect(device.screen.getByText("Sore knee").query()).not.toBeNull();
  });

  test("after sync() and unsync(): the screen has caught up", async () => {
    const note = fx.note({ text: "Pharmacy called back" });
    const device = await open();
    await device.sync(note);
    expect(device.screen.getByText("Pharmacy called back").query()).toBeNull();
    await device.settle();
    expect(device.screen.getByText("Pharmacy called back").query()).not.toBeNull();
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

describe("the first settle waits for the route to mount", () => {
  const lateUrl = `/app/groups/${TEST_GROUP.id}/late`;
  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  /** A loader still reading long after the database and the DOM have gone quiet. */
  const framesLater = async (frames: number) => {
    for (let i = 0; i < frames; i++) await nextFrame();
    return null;
  };
  const lateRoute = (clientLoader: () => unknown) => ({
    path: "/app/groups/:groupId/late",
    module: { default: () => <p data-late>Mounted</p>, clientLoader },
  });
  const mounted = () => document.querySelector("[data-late]") !== null;

  test("a route whose loader resolves late is mounted when renderWithDevice returns", async () => {
    await renderWithDevice({ route: lateRoute(() => framesLater(30)), url: lateUrl });
    expect(mounted()).toBe(true);
  });

  test("settle: false still returns before a late route has mounted", async () => {
    await renderWithDevice({ route: lateRoute(() => framesLater(30)), url: lateUrl, settle: false });
    expect(mounted()).toBe(false);
    await expect.poll(mounted).toBe(true);
  });

  test("a screen with no main counts as mounted", async () => {
    await renderWithDevice({ route: lateRoute(() => framesLater(5)), url: lateUrl });
    expect(document.querySelector("main")).toBeNull();
    expect(mounted()).toBe(true);
  });

  test("a loader that throws returns with its error showing, without waiting out the limit", async () => {
    const start = performance.now();
    const device = await renderWithDevice({
      route: { path: "/admin/notes", module: serverRoute },
      url: "/admin/notes",
    });
    expect(performance.now() - start).toBeLessThan(WAIT_TIMEOUT);
    await expect
      .element(device.screen.getByRole("heading", { name: /has a server loader/ }))
      .toBeInTheDocument();
  });

  test("a render that never mounts returns at the limit instead of hanging or throwing", async () => {
    await renderWithDevice({ route: lateRoute(() => new Promise(() => undefined)), url: lateUrl });
    expect(mounted()).toBe(false);
  });
});

describe("found", () => {
  test("waits for an element that appears late, treating a throwing read as not there yet", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    setTimeout(() => host.append(Object.assign(document.createElement("button"), { id: "late" })), 150);
    const button = await found(() => {
      if (!host.querySelector("#late")) throw new TypeError("not rendered");
      return host.querySelector("#late");
    });
    expect(button.id).toBe("late");
    host.remove();
  });

  test("times out, saying what it waited for", async () => {
    await expect(
      // eslint-disable-next-line caretook/no-call-timeout -- the timeout itself is what's tested
      found(() => document.querySelector("#never"), { timeout: 100, message: "the never button" }),
    ).rejects.toThrow(/found: no element within 100 ms: the never button \(.*#never.*\)\./);
  });
});
