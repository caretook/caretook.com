/**
 * The labels marked required in `scope`: each `*` mark's label text, without
 * the mark, in document order (B-684's `RequiredLabel`). None when `scope` is.
 */
export const requiredLabels = (scope: ParentNode | null | undefined) =>
  [...(scope?.querySelectorAll("[data-required-mark]") ?? [])].map((mark) =>
    (mark.parentElement?.textContent ?? "").replace(/\*$/, "").trim(),
  );

/** Whether any text in `scope` says "(optional)" or "Optional" (a label's or a help line's). */
export const saysOptional = (scope: ParentNode | null | undefined) => {
  const text = scope?.textContent ?? "";
  return /\(optional\)/i.test(text) || /Optional/.test(text);
};
