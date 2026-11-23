import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { LinkProps } from "react-router";
import type { Accent } from "./accents";
import type { MenuEntry } from "./menuModel";

import { Plus } from "lucide-react";
import { Button } from "./Button";
import { IconChip } from "./IconChip";
import { Menu } from "./Menu";
import { TITLE_PAGE } from "./styles";

type DataHooks = { [data: `data-${string}`]: string | undefined };

/**
 * A page's add control: its `label` (the `+`'s accessible name and tooltip,
 * "Add provider") and one of a link (`to`, with `state`, `prefetch`,
 * `preventScrollReset`), a callback (`onPress`) or menu items (`items`, the
 * kit's menu model). `data-*` go on the control.
 */
export type PageHeaderAdd = DataHooks & { label: string } & (
    | ({ to: LinkProps["to"]; state?: unknown; onPress?: never; items?: never } & Pick<
        LinkProps,
        "prefetch" | "preventScrollReset"
      >)
    | { onPress: () => void; to?: never; items?: never }
    | { items: readonly MenuEntry[]; menuLabel?: string; to?: never; onPress?: never }
  );

/** The `+`'s look: a primary, small, icon-only button. */
const LOOK = { variant: "primary", size: "sm" } as const;

/**
 * A section page's header: its name as the `h1` on the left and, on the
 * right, top-aligned and wrapping on narrow screens, an optional actions node
 * (a link, a button group, a menu), then the page's add control. No
 * subtitle: pages name themselves, not the recipient. `description` is the
 * one quiet line under the title (a page's purpose or a viewer note).
 * `add` is the primary, icon-only `+`, always the last control at the top
 * right (`actions` sit to its left); the page passes it for writers only.
 * `icon` and `accent` are the section's soft chip before the title, on its
 * line and decorative, so the `h1` is named by the title alone.
 * `className` is for the outer element only.
 */
export function PageHeader({
  title,
  actions,
  add,
  description,
  icon,
  accent,
  className = "",
}: {
  title: string;
  actions?: ReactNode;
  add?: PageHeaderAdd | false | null;
  description?: ReactNode;
  icon?: LucideIcon;
  accent?: Accent;
  className?: string;
}) {
  const hasActions = actions != null && actions !== false;
  const heading = <h1 className={`min-w-0 ${TITLE_PAGE}`}>{title}</h1>;
  const titleLine = icon ? (
    <div className="flex min-w-0 items-center gap-2">
      <IconChip icon={icon} accent={accent} />
      {heading}
    </div>
  ) : (
    heading
  );
  return (
    <header className={`flex flex-wrap items-start justify-between gap-3 ${className}`}>
      {description ? (
        <div className="min-w-0">
          {titleLine}
          <p className="text-muted text-sm">{description}</p>
        </div>
      ) : (
        titleLine
      )}
      {(hasActions || add) && (
        <div className="flex shrink-0 items-center justify-end gap-2">
          {hasActions && <div className="flex flex-wrap items-center justify-end gap-1">{actions}</div>}
          {add && <AddControl add={add} />}
        </div>
      )}
    </header>
  );
}

function AddControl({ add }: { add: PageHeaderAdd }) {
  if (add.items) {
    const { label, items, menuLabel, ...data } = add;
    return (
      <Menu
        {...LOOK}
        shape="square"
        label={label}
        title={label}
        menuLabel={menuLabel}
        items={items}
        {...data}
      >
        <Plus className="size-4" aria-hidden="true" />
      </Menu>
    );
  }
  if (add.onPress) {
    const { label, onPress, ...data } = add;
    return <Button {...LOOK} icon={Plus} label={label} onClick={onPress} {...data} />;
  }
  const { label, to, state, prefetch, preventScrollReset, ...data } = add;
  return (
    <Button
      {...LOOK}
      icon={Plus}
      label={label}
      to={to}
      state={state}
      prefetch={prefetch}
      preventScrollReset={preventScrollReset}
      {...data}
    />
  );
}
