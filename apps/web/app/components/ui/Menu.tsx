import type { ReactNode } from "react";
import type { NavigateOptions } from "react-router";
import type { MenuEntry, MenuItem, NormalizedSection } from "./menuModel";

import { Check } from "lucide-react";
import { useMemo } from "react";
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
import { chosenKey, linkOptions, normalizeMenu, sectionName } from "./menuModel";
import { SURFACE } from "./styles";

// Link items' router options (their history state) are React Router's.
declare module "react-aria-components" {
  interface RouterConfig {
    routerOptions: NavigateOptions;
  }
}

const WIDTH = { sm: "w-44", md: "w-56", lg: "w-64" } as const;
const ITEM =
  "rounded-field flex cursor-pointer items-center gap-2 px-3 py-2 outline-none data-[focused]:bg-base-200 data-[disabled]:cursor-default data-[disabled]:opacity-50";

/**
 * A button that opens a menu (React Aria: tap or Enter/Space/arrows to
 * open, arrow keys and typeahead to move, Escape or a choice to close, focus
 * back on the button). Callers pass data, never React Aria parts or class
 * strings: `items` is a list of items, sections (with a heading, a
 * non-interactive header block, or single selection, whose items are
 * `menuitemradio`) and `SEPARATOR`s; see `menuModel.ts`.
 *
 * The menu is named by the button (its `label`, else its text) unless
 * `menuLabel` is given. Link items navigate through React Router, with their
 * `state` as history state.
 */
export function Menu({
  label,
  menuLabel,
  children,
  className,
  isDisabled,
  items,
  placement = "bottom end",
  width = "sm",
  scrollable,
}: {
  /** The button's accessible name, when its content is only an icon or needs more words. */
  label?: string;
  /** The menu's accessible name. Default: the button's. */
  menuLabel?: string;
  /** The button's content (an icon, a name, an avatar). */
  children: ReactNode;
  /** Classes for the button (the outer element). */
  className?: string;
  isDisabled?: boolean;
  items: readonly MenuEntry[];
  placement?: "bottom start" | "bottom end";
  width?: keyof typeof WIDTH;
  /** Long lists: caps the height (20rem) and scrolls. */
  scrollable?: boolean;
}) {
  const navigate = useNavigate();
  const entries = useMemo(() => normalizeMenu(items), [items]);

  return (
    <RouterProvider navigate={(to, options) => void navigate(to, options)} useHref={useHref}>
      <MenuTrigger>
        <Button aria-label={label} className={className} isDisabled={isDisabled}>
          {children}
        </Button>
        <Popover
          placement={placement}
          className={`${SURFACE} ${scrollable ? "max-h-80 overflow-y-auto" : ""}`}
        >
          <AriaMenu aria-label={menuLabel} className={`menu ${WIDTH[width]} outline-none`}>
            {entries.map((entry) =>
              entry.type === "separator" ? (
                <Separator key={entry.id} className="border-base-300 my-1 border-t" />
              ) : entry.type === "section" ? (
                <Section key={entry.id} section={entry} />
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
          {header.subtitle && (
            <span className="text-base-content/70 block truncate text-sm">{header.subtitle}</span>
          )}
        </Header>
      ) : (
        title && (
          <Header className="text-base-content/70 px-3 pt-1 text-xs font-semibold uppercase">
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

function Item({ item, selectable }: { item: MenuItem; selectable?: boolean }) {
  const Icon = item.icon;
  return (
    <AriaMenuItem
      id={item.id}
      textValue={item.label}
      href={item.href}
      routerOptions={linkOptions(item)}
      isDisabled={item.isDisabled}
      onAction={selectable ? undefined : item.onAction}
      className={`${ITEM} ${item.tone === "danger" ? "text-error" : ""}`}
    >
      {({ isSelected }) => (
        <>
          {Icon && <Icon aria-hidden="true" className="size-4 shrink-0" />}
          {item.description ? (
            <span className="min-w-0 flex-1">
              <span className="block truncate">{item.label}</span>
              <span className="text-base-content/70 block truncate text-sm">{item.description}</span>
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
