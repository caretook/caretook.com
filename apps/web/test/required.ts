/**
 * The labels and legends in `scope` that carry the required `*`
 * (`RequiredLabel`'s `data-required-mark`), in order, without the mark: what
 * a form marks required ("Symptom", "When").
 */
export const requiredLabels = (scope: ParentNode | null | undefined) =>
  [...(scope?.querySelectorAll("[data-required-mark]") ?? [])].map((mark) =>
    (mark.parentElement?.textContent ?? "").replace(/\*$/, "").trim(),
  );
