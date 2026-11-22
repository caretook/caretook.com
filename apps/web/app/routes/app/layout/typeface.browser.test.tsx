import { afterEach, describe, expect, test, vi } from "vitest";
import { renderWithDevice } from "../../../../test/device";
import { found } from "../../../../test/found";
import { openPlanner, fixClock as fixPlannerClock } from "../groups/planner/plannerWorld";
import {
  MEDICATION_ROUTES,
  SCHEDULE,
  fixClock as fixMedicationClock,
  world,
} from "../groups/medications/medicationWorld";

// The typeface (B-415): app.css's @font-face and --font-sans, on /app pages in
// the frame. The family is found and loaded from our own files; code keeps the
// monospace stack; and the wider face doesn't push a narrow phone's page
// sideways (the Medications and Planner tab bars, a header with a title and
// two actions, the app header and the bottom bar).

const FAMILY = "Atkinson Hyperlegible Next";

const openMedications = (width = 420) =>
  renderWithDevice({
    route: MEDICATION_ROUTES,
    url: SCHEDULE,
    role: "caretaker",
    fixtures: world(),
    frame: true,
    width,
  });

const firstFamily = (el: Element) =>
  getComputedStyle(el)
    .fontFamily.split(",")[0]!
    .trim()
    .replace(/^["']|["']$/g, "");

/** The page doesn't scroll sideways, once the face has loaded (it is what could widen it). */
async function noSidewaysScroll() {
  await document.fonts.ready;
  const root = document.documentElement;
  await expect.poll(() => root.scrollWidth - root.clientWidth).toBeLessThanOrEqual(0);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("the typeface", () => {
  test("the body and a button use it, its file loads, and code keeps the monospace stack", async () => {
    fixMedicationClock();
    await openMedications();
    const button = await found(() => document.querySelector("main header button"));
    expect(firstFamily(document.body)).toBe(FAMILY);
    expect(firstFamily(button)).toBe(FAMILY);

    // Loading it finds a face (the @font-face file was served), for upright and italic.
    for (const style of ["normal", "italic"]) {
      const faces = await document.fonts.load(`${style} 400 16px "${FAMILY}"`);
      expect(faces.length).toBeGreaterThan(0);
      expect(faces.every((f) => f.status === "loaded")).toBe(true);
    }
    expect(document.fonts.check(`600 16px "${FAMILY}"`)).toBe(true);

    const code = document.createElement("code");
    code.textContent = "I l 1 O 0";
    document.querySelector("main")!.append(code);
    expect(firstFamily(code)).toBe("ui-monospace");
    code.remove();
  });
});

describe.each([320, 420])("at %i px nothing scrolls the page sideways", (width) => {
  test("Medications: its tab bar, its header (the title, Print and Add), the app header and the bottom bar", async () => {
    fixMedicationClock();
    await openMedications(width);
    await found(() => document.querySelector('main nav[aria-label="Medications tabs"]'));
    const header = await found(() => document.querySelector("main header"));
    expect(header.querySelector("h1")?.textContent?.trim()).toBe("Medications");
    expect(header.querySelectorAll("button, a").length).toBeGreaterThanOrEqual(2);
    expect(document.querySelector("nav[data-tab-bar]")).not.toBeNull();
    await noSidewaysScroll();
  });

  test("the Planner: its tab bar and header", async () => {
    fixPlannerClock();
    await openPlanner({ frame: true, width });
    await found(() => document.querySelector("main header h1"));
    await found(() => document.querySelector("main nav a[aria-current='page']"));
    await noSidewaysScroll();
  });
});
