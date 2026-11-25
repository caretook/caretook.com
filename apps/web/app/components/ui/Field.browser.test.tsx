import { describe, expect, test } from "vitest";

import { textContrast } from "../../../test/contrast";
import { renderInRouter } from "../../../test/device";
import { DateTimeField } from "./date";
import { CheckField, ChoiceGroup, ComboBox, Field } from "./index";

const classOf = (name: string) => document.querySelector(`[name="${name}"]`)!.className;

describe("Field's control classes", () => {
  test("an input, a select and a textarea each get their classes", async () => {
    await renderInRouter(
      <>
        <Field label="Name" kind="input">
          {(control) => <input {...control} name="name" />}
        </Field>
        <Field label="Unit" kind="select">
          {(control) => (
            <select {...control} name="unit">
              <option>mg</option>
            </select>
          )}
        </Field>
        <Field label="Notes" kind="textarea">
          {(control) => <textarea {...control} name="notes" />}
        </Field>
      </>,
    );
    expect(classOf("name")).toBe("input w-full");
    expect(classOf("unit")).toBe("select w-full");
    expect(classOf("notes")).toBe("textarea w-full");
  });

  test("with an error the control gets the error style", async () => {
    const { screen } = await renderInRouter(
      <>
        <Field label="Email" kind="input" error="Enter an email address.">
          {(control) => <input {...control} name="email" />}
        </Field>
        <Field label="Time zone" kind="select" error="Pick a time zone.">
          {(control) => (
            <select {...control} name="zone">
              <option>UTC</option>
            </select>
          )}
        </Field>
        <Field label="Address" kind="textarea" error="Too long.">
          {(control) => <textarea {...control} name="address" />}
        </Field>
      </>,
    );
    expect(classOf("email")).toBe("input input-error w-full");
    expect(classOf("zone")).toBe("select select-error w-full");
    expect(classOf("address")).toBe("textarea textarea-error w-full");
    await expect
      .element(screen.getByRole("textbox", { name: "Email" }))
      .toHaveAttribute("aria-invalid", "true");
  });

  test("a caller's className replaces the default", async () => {
    await renderInRouter(
      <Field label="Dose" kind="input" error="Say how much.">
        {(control) => <input {...control} name="dose" className="input input-sm" />}
      </Field>,
    );
    expect(classOf("dose")).toBe("input input-sm");
  });

  test("without a kind the control gets no classes (the caller styles it)", async () => {
    await renderInRouter(<Field label="Plain">{(control) => <input {...control} name="plain" />}</Field>);
    expect(classOf("plain")).toBe("");
  });
});

const UNITS = [
  { value: "mg", label: "mg" },
  { value: "ml", label: "ml" },
] as const;

/** The `*` after the label in `scope` (the field's wrapper), if it has one. */
const markIn = (scope: Element | null) => scope?.querySelector("[data-required-mark]") ?? null;

describe("required fields (B-684)", () => {
  test("a required Field shows a hidden * after its label; its control is aria-required, not required", async () => {
    const { screen } = await renderInRouter(
      <>
        <Field label="Name" kind="input" required>
          {(control) => <input {...control} name="name" />}
        </Field>
        <Field label="Nickname" kind="input">
          {(control) => <input {...control} name="nickname" />}
        </Field>
        <Field label="Condition" required>
          {(control) => (
            <ComboBox
              label="Condition"
              options={[]}
              inputValue=""
              onInputChange={() => undefined}
              onSelect={() => undefined}
              control={{ ...control, name: "condition" }}
            />
          )}
        </Field>
      </>,
    );
    const name = screen.getByRole("textbox", { name: "Name", exact: true });
    await expect.element(name).toHaveAttribute("aria-required", "true");
    await expect.element(name).not.toHaveAttribute("required");
    const label = document.querySelector('label[for="' + name.element().id + '"]')!;
    expect(label.textContent).toBe("Name*");
    expect(markIn(label)?.getAttribute("aria-hidden")).toBe("true");

    const nickname = screen.getByRole("textbox", { name: "Nickname" });
    await expect.element(nickname).not.toHaveAttribute("aria-required");
    await expect.element(nickname).not.toHaveAttribute("required");
    expect(markIn(nickname.element().closest("fieldset"))).toBeNull();

    // A ComboBox inside a required Field takes the control's aria-required.
    const condition = document.querySelector('[name="condition"]')!;
    expect(condition.getAttribute("aria-required")).toBe("true");
    expect(condition.hasAttribute("required")).toBe(false);
  });

  test("a required ChoiceGroup marks its label and its radiogroup; without it, neither", async () => {
    const { screen } = await renderInRouter(
      <>
        <ChoiceGroup
          name="unit"
          label="Unit"
          options={UNITS}
          value={null}
          onChange={() => undefined}
          required
        />
        <ChoiceGroup name="other" label="Other unit" options={UNITS} defaultValue="mg" />
      </>,
    );
    const group = screen.getByRole("radiogroup", { name: "Unit", exact: true });
    await expect.element(group).toHaveAttribute("aria-required", "true");
    const label = document.getElementById(group.element().getAttribute("aria-labelledby")!)!;
    expect(label.textContent).toBe("Unit*");
    expect(markIn(label)?.getAttribute("aria-hidden")).toBe("true");
    for (const radio of group.element().querySelectorAll("input")) expect(radio.required).toBe(false);

    const other = screen.getByRole("radiogroup", { name: "Other unit" });
    await expect.element(other).not.toHaveAttribute("aria-required");
    expect(markIn(other.element().parentElement)).toBeNull();
  });

  test("a required CheckField marks its label and its input (aria-required, not required); without it, neither", async () => {
    const { screen } = await renderInRouter(
      <>
        <CheckField label="I know them" name="attested" required />
        <CheckField label="Email me too" name="copy" />
      </>,
    );
    const box = screen.getByRole("checkbox", { name: "I know them" });
    await expect.element(box).toHaveAttribute("aria-required", "true");
    await expect.element(box).not.toHaveAttribute("required");
    const label = document.querySelector('label[for="' + box.element().id + '"]')!;
    expect(label.textContent).toBe("I know them*");
    expect(markIn(label)?.getAttribute("aria-hidden")).toBe("true");

    const plain = screen.getByRole("checkbox", { name: "Email me too" });
    await expect.element(plain).not.toHaveAttribute("aria-required");
    await expect.element(plain).not.toHaveAttribute("required");
    expect(markIn(plain.element().parentElement)).toBeNull();
  });

  test("a required DateTimeField marks its label and its segments; without it, neither", async () => {
    await renderInRouter(
      <>
        <div data-field="starts">
          <DateTimeField label="Starts" defaultValue="2027-06-09T17:00:00.000Z" required />
        </div>
        <div data-field="ends">
          <DateTimeField label="Ends" defaultValue="2027-06-09T18:00:00.000Z" />
        </div>
      </>,
    );
    const starts = document.querySelector('[data-field="starts"]')!;
    const label = starts.querySelector(".fieldset-legend")!;
    expect(label.textContent).toBe("Starts*");
    expect(markIn(label)?.getAttribute("aria-hidden")).toBe("true");
    const segments = [...starts.querySelectorAll('[role="spinbutton"]')];
    expect(segments.length).toBeGreaterThan(0);
    for (const segment of segments) expect(segment.getAttribute("aria-required")).toBe("true");
    expect(starts.querySelector("[required]:not([type=hidden])")).toBeNull();

    const ends = document.querySelector('[data-field="ends"]')!;
    expect(markIn(ends)).toBeNull();
    expect(ends.querySelector('[aria-required="true"]')).toBeNull();
  });

  test.each(["light", "dark"] as const)(
    "the * keeps 4.5:1 on the page and on a card (or sheet) in %s",
    async (theme) => {
      await renderInRouter(
        <>
          {(["bg-base-200", "bg-base-100"] as const).map((surface) => (
            <div key={surface} data-surface={surface} className={surface}>
              <Field label="Name" kind="input" required>
                {(control) => <input {...control} />}
              </Field>
            </div>
          ))}
        </>,
        { theme },
      );
      const measured: Record<string, number> = {};
      for (const surface of ["bg-base-200", "bg-base-100"]) {
        const mark = markIn(document.querySelector(`[data-surface="${surface}"]`))!;
        const value = textContrast(mark);
        measured[surface] = Math.round(value * 100) / 100;
        expect(value, `the * on ${surface}, ${theme}`).toBeGreaterThanOrEqual(4.5);
      }
      console.info(theme, JSON.stringify(measured));
    },
  );
});
