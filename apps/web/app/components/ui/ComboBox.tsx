import { useEffect, useRef } from "react";
import {
  ComboBox as AriaComboBox,
  Input,
  ListBox,
  ListBoxItem,
  Popover as AriaPopover,
} from "react-aria-components";
import { SURFACE } from "./styles";

/** One choice in a combo box: `description` is a second, dimmer line. */
export type ComboBoxOption = { id: string; label: string; description?: string };

const CREATE = "\u0000create";
const ITEM =
  "rounded-field flex cursor-pointer flex-col px-3 py-2 outline-none data-[focused]:bg-base-200 data-[disabled]:opacity-50";

/**
 * A text field with a list of choices under it (React Aria: the list opens
 * on focus, arrow keys move, Enter or a tap picks, Escape closes the list and
 * then the field). The caller owns the text and filters `options` itself;
 * the combo box shows them as given. With `onCreate`, typed text that isn't
 * empty adds a last choice, `createLabel(text)`, that calls it.
 *
 * `onClose` is called when the field loses focus or Escape is pressed with
 * the list closed, so a caller showing it in place of a button can go back.
 */
export function ComboBox({
  label,
  placeholder,
  options,
  inputValue,
  onInputChange,
  onSelect,
  createLabel,
  onCreate,
  emptyText = "No matches",
  onClose,
  focusOnMount,
}: {
  /** The field's accessible name. */
  label: string;
  placeholder?: string;
  options: readonly ComboBoxOption[];
  inputValue: string;
  onInputChange: (text: string) => void;
  onSelect: (id: string) => void;
  createLabel?: (text: string) => string;
  onCreate?: (text: string) => void;
  /** Shown in the list when nothing matches and there's nothing to create. */
  emptyText?: string;
  /** The field lost focus (`blur`, focus is elsewhere now) or Escape was pressed with the list closed (`escape`). */
  onClose?: (reason: "blur" | "escape") => void;
  /** Put the cursor in the field when it appears (it replaced the button that opened it). */
  focusOnMount?: boolean;
}) {
  const open = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusOnMount) input.current?.focus();
  }, [focusOnMount]);
  const typed = inputValue.trim();
  const items: ComboBoxOption[] =
    onCreate && typed
      ? [...options, { id: CREATE, label: createLabel ? createLabel(typed) : typed }]
      : [...options];

  return (
    <AriaComboBox
      aria-label={label}
      items={items}
      inputValue={inputValue}
      onInputChange={onInputChange}
      selectedKey={null}
      onSelectionChange={(key) => {
        if (key === null) return;
        if (key === CREATE) onCreate?.(typed);
        else onSelect(String(key));
      }}
      onOpenChange={(isOpen) => {
        open.current = isOpen;
      }}
      menuTrigger="focus"
      allowsCustomValue
      allowsEmptyCollection
      className="w-full"
    >
      <Input
        placeholder={placeholder}
        ref={input}
        autoComplete="off"
        onBlur={() => onClose?.("blur")}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !open.current) onClose?.("escape");
        }}
        className="input input-sm w-full"
      />
      <AriaPopover
        placement="bottom start"
        className={`${SURFACE} max-h-72 w-[var(--trigger-width)] min-w-56 overflow-y-auto p-1`}
      >
        <ListBox
          className="outline-none"
          renderEmptyState={() => <p className="text-base-content/70 px-3 py-2 text-sm">{emptyText}</p>}
        >
          {(item: ComboBoxOption) => (
            <ListBoxItem
              id={item.id}
              textValue={item.label}
              className={`${ITEM} ${item.id === CREATE ? "text-primary font-medium" : ""}`}
            >
              <span className="truncate">{item.label}</span>
              {item.description && (
                <span className="text-base-content/70 truncate text-sm">{item.description}</span>
              )}
            </ListBoxItem>
          )}
        </ListBox>
      </AriaPopover>
    </AriaComboBox>
  );
}
