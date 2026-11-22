import type { Rgba } from "../../../test/contrast";
import type { BadgeTone } from "./badgeClass";
import type { MessageTone } from "./Message";

import { afterEach, describe, expect, test } from "vitest";
import { commands } from "vitest/browser";

import { over, ratio, rgba, surfaceOf, textContrast, textOf } from "../../../test/contrast";
import { renderInRouter } from "../../../test/device";
import { Badge, Field, LINK, Message } from "./index";

// The secondary-text tokens (app.css) keep WCAG AA (4.5:1) on both surfaces in
// both themes, measured from the computed colours, the translucent text
// composited over its surface.
describe("text-muted and text-faint", () => {
  test.each(["light", "dark"] as const)("clear 4.5:1 on base-200 and base-100 in %s", async (theme) => {
    await renderInRouter(
      <>
        {(["bg-base-200", "bg-base-100"] as const).map((surface) => (
          <div key={surface} className={surface} data-surface={surface}>
            <p className="text-muted">Muted</p>
            <p className="text-faint">Faint</p>
          </div>
        ))}
      </>,
      { theme },
    );
    const measured: Record<string, number> = {};
    for (const surface of ["bg-base-200", "bg-base-100"]) {
      const box = document.querySelector<HTMLElement>(`[data-surface="${surface}"]`)!;
      for (const tone of ["text-muted", "text-faint"]) {
        const ratio = textContrast(box.querySelector(`.${tone}`)!);
        measured[`${tone} on ${surface}`] = Math.round(ratio * 100) / 100;
        expect(ratio, `${tone} on ${surface}, ${theme}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    console.info(theme, JSON.stringify(measured));
  });

  test("faint is quieter than muted", async () => {
    await renderInRouter(
      <div className="bg-base-200">
        <p className="text-muted">Muted</p>
        <p className="text-faint">Faint</p>
      </div>,
    );
    const alpha = (c: string) => Number(/\/ ([\d.]+)\)/.exec(c)?.[1] ?? 1);
    const [muted, faint] = ["text-muted", "text-faint"].map((t) =>
      alpha(getComputedStyle(document.querySelector(`.${t}`)!).color),
    );
    expect(faint).toBeLessThan(muted!);
  });
});

const THEMES = ["light", "dark"] as const;
const SURFACES = ["bg-base-200", "bg-base-100"] as const;
const KINDS = ["input", "select", "textarea"] as const;
const round = (n: number) => Math.round(n * 100) / 100;
const box = (sel: string) => document.querySelector<HTMLElement>(sel)!;
const swatch = (cls: string) => {
  const el = document.createElement("div");
  el.className = cls;
  document.body.append(el);
  const colour = surfaceOf(el);
  el.remove();
  return colour;
};

/** A field of each kind, with a placeholder, on `surface`. */
const fields = (surface: string, extra: { disabled?: boolean } = {}) => (
  <div key={surface} className={`${surface} p-2`} data-surface={surface}>
    {KINDS.map((kind) => (
      <Field key={kind} kind={kind} label={`A ${kind}`}>
        {(control) =>
          kind === "select" ? (
            <select {...control} {...extra} data-kind={kind} defaultValue="one">
              <option value="one">One</option>
            </select>
          ) : kind === "textarea" ? (
            <textarea {...control} {...extra} data-kind={kind} placeholder="Notes" />
          ) : (
            <input {...control} {...extra} data-kind={kind} placeholder="A name" />
          )
        }
      </Field>
    ))}
    <p className="text-faint" data-faint="">
      Faint
    </p>
  </div>
);

/** A control's placeholder colour as painted on the control. */
const placeholderOf = (el: Element): Rgba => {
  const style = getComputedStyle(el, "::placeholder");
  const [r, g, b, a] = rgba(style.color);
  return over([r, g, b, a * Number(style.opacity || 1)], surfaceOf(el));
};

describe("surfaces (ui-kit-3)", () => {
  test("in dark the page, a card and a border step up in lightness, each visibly", async () => {
    await renderInRouter(<p>Surfaces</p>, { theme: "dark" });
    const [page, card, border] = [swatch("bg-base-200"), swatch("bg-base-100"), swatch("bg-base-300")];
    const cardOnPage = ratio(card, page);
    const borderOnCard = ratio(border, card);
    expect(cardOnPage).toBeGreaterThanOrEqual(1.2);
    expect(borderOnCard).toBeGreaterThanOrEqual(1.2);
    const luma = ([r, g, b]: Rgba) => r + g + b;
    expect(luma(card)).toBeGreaterThan(luma(page));
    expect(luma(border)).toBeGreaterThan(luma(card));
    console.info(
      "dark",
      JSON.stringify({
        page,
        card,
        border,
        cardOnPage: round(cardOnPage),
        borderOnCard: round(borderOnCard),
      }),
    );
  });

  test("light's three bases are unchanged", async () => {
    await renderInRouter(<p>Surfaces</p>, { theme: "light" });
    expect(swatch("bg-base-100")).toEqual(rgba("oklch(100% 0 0)"));
    expect(swatch("bg-base-200")).toEqual(rgba("oklch(96.5% 0.007 255)"));
    expect(swatch("bg-base-300")).toEqual(rgba("oklch(89.5% 0.012 255)"));
  });
});

describe("the field fill (ui-kit-3)", () => {
  afterEach(() => commands.media(null));

  test.each(THEMES)(
    "in %s every kind of field has a fill of its own on the page and a card, with readable text and placeholder",
    async (theme) => {
      await renderInRouter(<>{SURFACES.map((surface) => fields(surface))}</>, { theme });
      const [page, card] = [swatch(SURFACES[0]), swatch(SURFACES[1])];
      const measured: Record<string, number> = {};
      for (const surface of SURFACES) {
        for (const kind of KINDS) {
          const control = box(`[data-surface="${surface}"] [data-kind="${kind}"]`);
          const fill = surfaceOf(control);
          const name = `${kind} on ${surface}, ${theme}`;
          measured[`${kind} fill/page`] = round(ratio(fill, page));
          measured[`${kind} fill/card`] = round(ratio(fill, card));
          expect(ratio(fill, page), `${name}: fill against the page`).toBeGreaterThanOrEqual(1.05);
          expect(ratio(fill, card), `${name}: fill against a card`).toBeGreaterThanOrEqual(1.05);
          expect(ratio(textOf(control), fill), `${name}: text`).toBeGreaterThanOrEqual(4.5);
          if (kind !== "select") {
            const placeholder = ratio(placeholderOf(control), fill);
            measured[`${kind} placeholder`] = round(placeholder);
            expect(placeholder, `${name}: placeholder`).toBeGreaterThanOrEqual(4.5);
          }
        }
      }
      // text-faint, as if it sat on the fill.
      const faint = box('[data-surface="bg-base-100"] [data-faint]');
      const fill = surfaceOf(box('[data-surface="bg-base-100"] [data-kind="input"]'));
      const faintOnField = ratio(over(rgba(getComputedStyle(faint).color), fill), fill);
      measured["text-faint on the fill"] = round(faintOnField);
      expect(faintOnField).toBeGreaterThanOrEqual(4.5);
      console.info(theme, JSON.stringify(measured));
    },
  );

  test.each(THEMES)("in %s a disabled field looks different from an enabled one", async (theme) => {
    await renderInRouter(
      <>
        <div data-state="enabled">{fields("bg-base-100")}</div>
        <div data-state="disabled">{fields("bg-base-100", { disabled: true })}</div>
      </>,
      { theme },
    );
    for (const kind of KINDS) {
      const [on, off] = ["enabled", "disabled"].map((state) =>
        box(`[data-state="${state}"] [data-kind="${kind}"]`),
      );
      const same = ratio(surfaceOf(on!), surfaceOf(off!)) < 1.02 && ratio(textOf(on!), textOf(off!)) < 1.02;
      expect(same, `${kind}, ${theme}`).toBe(false);
    }
  });

  test.each(THEMES)("in %s a ghost input stays transparent", async (theme) => {
    await renderInRouter(
      <div className="bg-base-100">
        <input aria-label="Title" className="input input-ghost" defaultValue="A title" />
      </div>,
      { theme },
    );
    const ghost = box("input.input-ghost");
    expect(rgba(getComputedStyle(ghost).backgroundColor)[3]).toBe(0);
  });

  test.each(THEMES)("printed from %s, a field is white", async (theme) => {
    await renderInRouter(fields("bg-base-100"), { theme });
    await commands.media("print");
    for (const kind of KINDS) {
      await expect
        .poll(() => surfaceOf(box(`[data-kind="${kind}"]`)), { message: kind })
        .toEqual([255, 255, 255, 1]);
    }
  });
});

describe("the kit's coloured text (ui-kit-3)", () => {
  const MESSAGE_TONES: MessageTone[] = ["error", "success", "warning", "info"];
  const BADGE_TONES: BadgeTone[] = ["neutral", "primary", "success", "warning", "danger", "info"];

  test.each(THEMES)(
    "in %s a link, a field's error and warning, each Message and each Badge clear 4.5:1 on the page and a card",
    async (theme) => {
      await renderInRouter(
        <>
          {SURFACES.map((surface) => (
            <div key={surface} className={`${surface} p-2`} data-surface={surface}>
              <a href="#here" className={LINK} data-probe="link">
                A link
              </a>
              <Field kind="input" label="With an error" error="Needs a name">
                {(control) => <input {...control} />}
              </Field>
              <Field kind="input" label="With a warning" warning="That date is in the past">
                {(control) => <input {...control} />}
              </Field>
              {MESSAGE_TONES.map((tone) => (
                <Message key={tone} tone={tone} data-probe={`message ${tone}`}>
                  Saved
                </Message>
              ))}
              {BADGE_TONES.map((tone) => (
                <Badge key={tone} tone={tone} data-probe={`badge ${tone}`}>
                  {tone}
                </Badge>
              ))}
            </div>
          ))}
        </>,
        { theme },
      );
      const measured: Record<string, number> = {};
      for (const surface of SURFACES) {
        const within = box(`[data-surface="${surface}"]`);
        const probes: [string, Element][] = [
          ...[...within.querySelectorAll("[data-probe]")].map(
            (el) => [el.getAttribute("data-probe")!, el] as [string, Element],
          ),
          ["field error", [...within.querySelectorAll("p")].find((p) => p.textContent === "Needs a name")!],
          [
            "field warning",
            [...within.querySelectorAll("p")].find((p) => p.textContent === "That date is in the past")!,
          ],
        ];
        for (const [name, el] of probes) {
          const contrast = textContrast(el);
          measured[`${name} on ${surface}`] = round(contrast);
          expect(contrast, `${name} on ${surface}, ${theme}`).toBeGreaterThanOrEqual(4.5);
        }
      }
      console.info(theme, JSON.stringify(measured));
    },
  );
});
