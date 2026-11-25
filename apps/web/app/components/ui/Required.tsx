import type { ReactNode } from "react";

/**
 * A required field's label: its text, then a `*` in the error ink (4.5:1 on
 * the page, a card and a field in both themes), hidden from screen readers,
 * which hear the control's `aria-required` instead. One span, so a flex label
 * (daisyUI's `fieldset-legend` spreads its children apart) keeps the mark
 * beside the text. Not required, the label is left as it is.
 */
export function RequiredLabel({ required, children }: { required?: boolean; children: ReactNode }) {
  if (!required) return children;
  return (
    <span>
      {children}
      <span aria-hidden="true" data-required-mark="" className="text-error-ink ms-0.5">
        *
      </span>
    </span>
  );
}
