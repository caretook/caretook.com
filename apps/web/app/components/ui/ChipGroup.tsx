import type { ActionChip, LinkChip } from "./chips";

import { Link } from "react-router";
import { chipClass } from "./styles";

type Props = { label: string; className?: string } & (
  | {
      /** Links: a `nav` named `label`. Filters replace the history entry and keep the scroll. */
      links: readonly LinkChip[];
      replace?: boolean;
      preventScrollReset?: boolean;
    }
  | {
      /** Buttons: a list named `label`. */
      actions: readonly ActionChip[];
    }
);

/**
 * A wrapping row of chips, named `label`: links (a `nav`; the current one
 * has `aria-current="true"`) or buttons (a list; a toggle has `aria-pressed`).
 */
export function ChipGroup(props: Props) {
  const { label, className = "" } = props;
  const row = `flex flex-wrap gap-1.5 ${className}`;
  if ("links" in props) {
    return (
      <nav aria-label={label} className={row}>
        {props.links.map((chip) => (
          <Link
            key={chip.id}
            to={chip.to}
            replace={props.replace}
            preventScrollReset={props.preventScrollReset}
            className={chipClass(chip.current)}
            aria-current={chip.current ? "true" : undefined}
          >
            {chip.label}
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <ul aria-label={label} className={row}>
      {props.actions.map((chip) => (
        <li key={chip.id}>
          <button
            type="button"
            className={chipClass(!!chip.pressed)}
            aria-pressed={chip.pressed}
            onClick={chip.onPress}
          >
            {chip.label}
          </button>
        </li>
      ))}
    </ul>
  );
}
