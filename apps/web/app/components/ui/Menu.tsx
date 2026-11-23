import type { ReactNode } from "react";
import type { NavigateOptions } from "react-router";
import type { ButtonLook } from "./buttonClass";
import type { MenuEntry, MenuItem, NormalizedGroup, NormalizedSection } from "./menuModel";

import { Check } from "lucide-react";
import { useId, useMemo, useState } from "react";
import {
  Button,
  Header,
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  MenuSection as AriaMenuSection,
  MenuTrigger,
  Popover,
  RouterProvider,
  Separator,
} from "react-aria-components";
import { useHref, useNavigate } from "react-router";
import { buttonClass } from "./buttonClass";
import { Chevron } from "./Chevron";
import { chosenKey, linkOptions, normalizeMenu, sectionName } from "./menuModel";
import { SURFACE } from "./styles";

// Link items' router options (their history state) are React Router's.
declare module "react-aria-components" {
  interface RouterConfig {
    routerOptions: NavigateOptions;
  }
}

const WIDTH = { sm: "w-44", md: "w-56", lg: "w-64" } as const;
// Without its inline padding: px-3, or pl-9 (a group's items, under its label).
const ITEM =
  "rounded-field flex cursor-pointer items-center gap-2 py-2 outline-none data-[focused]:bg-base-200 data-[disabled]:cursor-default data-[disabled]:opacity-50";

/**
 * A button that opens a menu (React Aria: tap or Enter/Space/arrows to
 * open, arrow keys and typeahead to move, Escape or a choice to close, focus
 * back on the button). Callers pass data, never React Aria parts or class
 * strings: `items` is a list of items, sections (with a heading, a
 * non-interactive header block, or single selection, whose items are
 * `menuitemradio`), groups (an item that expands in place to its items,
 * keeping the menu open; all closed again each time it opens) and
 * `SEPARATOR`s; see `menuModel.ts`.
 *
 * The trigger takes a button's look (`variant`, `size`, `shape`, through
 * `buttonClass`), so it matches the buttons beside it; `className` then adds
 * outer classes. Without a look, `className` is the trigger's whole class
 * string (until the remaining menus move to a look).
 *
 * The menu is named by the button (its `label`, else its text) unless
 * `menuLabel` is given. Link items navigate through React Router, with their
 * `state` as history state. The menu fades in and out (`motion-overlay`,
 * `--motion-fast`); it leaves the DOM after its exit, well inside the wait
 * `useShowModal` gives a dialog opened from one of its items.
 */
export function Menu({
  label,
  menuLabel,
  children,
  className,
  variant,
  size,
  shape,
  isDisabled,
  items,
  placement = "bottom end",
  width = "sm",
  scrollable,
  title,
  ...data
}: {
  /** The button's accessible name, when its content is only an icon or needs more words. */
  label?: string;
  /** The menu's accessible name. Default: the button's. */
  menuLabel?: string;
  /** The button's content (an icon, a name, an avatar). */
  children: ReactNode;
  /** With a look, outer classes for the button; without one, its whole class string. */
  className?: string;
  /** The trigger's look, as a `Button`'s. */
  variant?: ButtonLook["variant"];
  size?: ButtonLook["size"];
  shape?: ButtonLook["shape"];
  isDisabled?: boolean;
  items: readonly MenuEntry[];
  placement?: "bottom start" | "bottom end";
  width?: keyof typeof WIDTH;
  /** Long lists: caps the height (20rem) and scrolls. */
  scrollable?: boolean;
  /** The button's tooltip (e.g. the same words as an icon-only button's `label`). */
  title?: string;
  /** `data-*` attributes for the button (hooks for tests and checks). */
  [data: `data-${string}`]: string | boolean | undefined;
}) {
  const navigate = useNavigate();
  // A sheet opened from an item finds this button to return focus to (the item is gone by then).
  const triggerKey = useId();
  const hasLook = variant !== undefined || size !== undefined || shape !== undefined;
  const triggerClass = hasLook
    ? `${buttonClass({ variant, size, shape })} ${className ?? ""}`.trim()
    : className;
  const entries = useMemo(() => normalizeMenu(items), [items]);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (id: string) =>
    setExpanded((open) => {
      const next = new Set(open);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <RouterProvider navigate={(to, options) => void navigate(to, options)} useHref={useHref}>
      <MenuTrigger onOpenChange={(isOpen) => isOpen && setExpanded(new Set())}>
        <Button
          aria-label={label}
          data-menu-trigger={triggerKey}
          className={triggerClass}
          isDisabled={isDisabled}
          // React Aria drops `title` (it keeps `data-*`): add it to the element it renders.
          render={title ? (props) => <button {...props} title={title} /> : undefined}
          {...data}
        >
          {children}
        </Button>
        <Popover
          placement={placement}
          className={`${SURFACE} motion-overlay ${scrollable ? "max-h-80 overflow-y-auto" : ""}`}
        >
          <AriaMenu
            data-menu-of={triggerKey}
            aria-label={menuLabel}
            // The trigger labels the menu by itself (`aria-labelledby`, which wins): an own name clears that.
            aria-labelledby={menuLabel ? "" : undefined}
            className={`menu ${WIDTH[width]} outline-none`}
          >
            {entries.flatMap((entry) =>
              entry.type === "separator" ? (
                <Separator key={entry.id} className="border-base-300 my-1 border-t" />
              ) : entry.type === "section" ? (
                <Section key={entry.id} section={entry} />
              ) : entry.type === "group" ? (
                groupEntries(entry, expanded.has(entry.id), () => toggle(entry.id))
              ) : (
                <Item key={entry.id} item={entry} />
              ),
            )}
          </AriaMenu>
        </Popover>
      </MenuTrigger>
    </RouterProvider>
  );
}

function Section({ section }: { section: NormalizedSection }) {
  const { header, title, selection } = section;
  return (
    <AriaMenuSection
      id={section.id}
      aria-label={title ? undefined : section.ariaLabel}
      {...(selection && {
        selectionMode: "single" as const,
        disallowEmptySelection: true,
        selectedKeys: [selection.selected],
        onSelectionChange: (keys) => {
          const next = chosenKey(keys, selection.selected);
          if (next !== null) selection.onChange(next);
        },
      })}
    >
      {header ? (
        <Header className="min-w-0 px-3 py-2">
          {header.title && <span className="block truncate font-semibold">{header.title}</span>}
          {header.subtitle && <span className="text-muted block truncate text-sm">{header.subtitle}</span>}
        </Header>
      ) : (
        title && (
          <Header className="text-muted px-3 pt-1 text-xs font-semibold uppercase">
            {sectionName(section)}
          </Header>
        )
      )}
      {section.items.map((item) => (
        <Item key={item.id} item={item} selectable={!!selection} />
      ))}
    </AriaMenuSection>
  );
}

/** A group's toggle, then (while it's expanded) its items, indented. */
function groupEntries(group: NormalizedGroup, isExpanded: boolean, onToggle: () => void) {
  const Icon = group.icon;
  const toggle = (
    <AriaMenuItem
      key={group.id}
      id={group.id}
      textValue={group.label}
      aria-expanded={isExpanded}
      shouldCloseOnSelect={false}
      onAction={onToggle}
      className={`${ITEM} px-3`}
    >
      {Icon && <Icon aria-hidden="true" className="size-4 shrink-0" />}
      <span className="min-w-0 flex-1 truncate">{group.label}</span>
      <Chevron open={isExpanded} />
    </AriaMenuItem>
  );
  if (!isExpanded) return [toggle];
  return [toggle, ...group.items.map((item) => <Item key={item.id} item={item} inGroup />)];
}

function Item({ item, selectable, inGroup }: { item: MenuItem; selectable?: boolean; inGroup?: boolean }) {
  const Icon = item.icon;
  return (
    <AriaMenuItem
      data-menu-group-item={inGroup || undefined}
      id={item.id}
      textValue={item.label}
      href={item.href}
      routerOptions={linkOptions(item)}
      isDisabled={item.isDisabled}
      onAction={selectable ? undefined : item.onAction}
      className={`${ITEM} ${inGroup ? "pr-3 pl-9" : "px-3"} ${item.tone === "danger" ? "text-error" : ""}`}
    >
      {({ isSelected }) => (
        <>
          {Icon && <Icon aria-hidden="true" className="size-4 shrink-0" />}
          {item.description ? (
            <span className="min-w-0 flex-1">
              <span className="block truncate">{item.label}</span>
              <span className="text-muted block truncate text-sm">{item.description}</span>
            </span>
          ) : (
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
          )}
          {selectable && (
            <Check aria-hidden="true" className={`size-4 shrink-0 ${isSelected ? "" : "invisible"}`} />
          )}
        </>
      )}
    </AriaMenuItem>
  );
}
