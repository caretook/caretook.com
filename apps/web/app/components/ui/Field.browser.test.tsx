import { describe, expect, test } from "vitest";

import { renderInRouter } from "../../../test/device";
import { Field } from "./index";

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
