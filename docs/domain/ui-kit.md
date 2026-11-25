# The UI kit (`apps/web/app/components/ui/`)

The `ui/` contracts; rules and tests: [components](components.md).

## What's in it

- **Primitives** (the `ui` index) import no feature folder; **only `ui/` imports React Aria** (lint).
- `ui/tooltip/` and `ui/date/` have their own indexes. `DateTimeField`: hour arrows cross AM/PM; in `InlineCalendars` the calendar opens inline, one at once; `onCalendarPick` fires on a calendar pick only.
- **`ui/plain`**, the light entry: everything without React Aria. Light pages (sign-in, account forms, `/connect`, marketing) import it, never `ui` (React Aria's chunk).
- **Append-only:** the `ui` and `ui/plain` indexes, `ui/styles.ts` and the gallery registry.
- **The gallery** `/dev/ui` (`routes/dev/ui/`, web only, 404 in production): each primitive in both themes, one `sections/` file each, listed in `registry.ts`. A new primitive (**only for a repeated pattern**) adds its section.

## Which to use

- **Every labelled form control is a `Field`** (pass `kind` and it owns the control's classes; only `ChoiceGroup` callers style a control); checkboxes and switches are `CheckField` and `ToggleField`; a card is a `Card`, a list box a `List` of `ListRow`s; every one-of-a-few choice a `ChoiceGroup` (native radios in a named `radiogroup`, a joined row, or `layout="grid"` two equal columns; `value` may be null); **every button a `Button`** (icon only: `icon` and a required `label`, its name and tooltip; `IconButton` is its ghost `sm` form); a form's Cancel and submit a `FormFooter`; a page's back link a `BackLink`; a question with two or three answers a `ChoiceDialog`; an expander a `Chevron` and a `Collapse`. Not a `Button`: nav bars, inline links, marketing's header and footer, expand toggles, `Menu` triggers, tabs, chips, row links, menu items, form controls, the date picker, avatars.
- **Messages:** an inline error or status line is a `Message`, a box a `Notice`, a "No … yet." line an `EmptyState`, a wait `Loading`, a badge a `Badge`.

## Contracts

- `Button`: `variant` `primary`, `secondary` (default), `ghost`, `danger`, `dangerQuiet`, `warning`; `size` `lg`, `md`, `sm`, `xs`; `shape` `rounded` (default), `pill`, `square`, `round`; `block`; `icon`. Icon only is `square` unless shaped; a button takes `pressed` (the toggle look, in place of the variant), `expanded`, `controls`. `busy` with `busyLabel` (disabled, `aria-busy`); type `button` by default. With `to` a router link (`replace`, `state`, `prefetch`, `preventScrollReset`); with `href` a plain `<a>`. Classes: the pure `buttonClass` (with `pressed`), which `TOOL_CIRCLE`, the chips, the date field and `Menu`'s trigger build on. `OUTLINED`: outlined, filled on hover and press. `IconButton` `count`: a corner badge (also in `label`).
- `Menu`'s trigger is always a `buttonClass` look, `className` only outer classes; section headings after the first get an 8px gap; `Popover`'s takes a look or a bare string. A nav link: `navLinkClass`. Solid `danger` only in a confirm, a form whose one job is destructive, or overdue Given all.
- `FormFooter` (forms only): Cancel (`{ label, to }` or `{ label, onCancel }`) then submit `Button` (`submitLabel`, `busy`, `busyLabel`, `submitDisabled`, `danger`, `size`); right-aligned, or `align="start"`; a `status` slot.
- `ConfirmDialog`/`useShowModal`: `confirmVariant` `danger` (default) or `primary`; waits for an open menu to close before `showModal()`; Escape closes only the dialog.
- `ChoiceDialog` (`open`, `title`, `message`, up to three `choices` `{ id, label, tone, data-* }`, `cancelLabel`, `onChoose(id)`, `onClose`): `ConfirmDialog`'s rules; choices stacked full width, then Cancel; `onClose` on every close.
- `PageHeader` `icon`, `accent`: a soft chip before the title. `add`: a `label` and a link (`to`), `onPress`, or `items` (`menuLabel`); a primary `sm` icon-only `+`, the last control, `actions` before it.
- `Chevron` (`open`, `closed` `right`|`down`). `Collapse` (`open`, `id`, `axis` `block`|`inline`): closed is inert, hidden, mounted; the toggle keeps `aria-expanded`, `aria-controls`.
- `Sheet` is full screen below `sm`, a centred modal from it, above the tab bar, and returns focus to its opener (from a `Menu` item: its button). Close, Escape and a tap outside play the exit (`useSheetExit`). The topmost sheet holds a path change for the exit (not a search or hash change, a submission or reduced motion); closing it sends a held navigation at once; a save plays the exit when its caller navigates. `guardChanges`: a changed form asks "Discard changes?" on those or Back, for the user's own edits only (not a sync); only a successful save skips it.
- **Accents** (`ui/accents.ts`): `ACCENTS` and `accentClass(accent | "neutral", "solid" | "soft" | "text")` over the `--color-hue-*` tokens; nothing else names one, and none is a status colour. `IconChip` is hidden from assistive tech unless labelled.
- `UserAvatar` `look` (`color`, `icon`, `defaultColor`, `neutral`) beats `image` when chosen; `row`: a row's author. Only `avatarLook.ts` names `--color-avatar-*`.
- `Field` gives its control the `id`, `aria-invalid`, `aria-describedby`; a `warning` line (not invalid) while there's no error. `kind` (`input`, `select`, `textarea`): `<kind> w-full`, `<kind>-error` on error (pure `fieldControlClass`); a later `className` replaces it.
- **Required fields pass `required`** (`Field`, `ChoiceGroup`, `CheckField`, `DateTimeField`): an `aria-hidden` `*` after the label (`text-error-ink`), `aria-required`, not native `required`. No "(optional)" or "Optional" help.
- `CheckField`, `ToggleField` (input props, `label`, `help?`, `error?`): a native checkbox (toggle: `role="switch"`), its label beside it (toggles it), help and error describing it (`aria-invalid` on error), `data-*` on the input; `aria-label` replaces the label.
- `Card` (`{ id?, title?, headingId?, actions? }`): `base-100`, one body gap; titled, a `section` named by its `h2` (`TITLE_SECTION`) with `data-section`, `actions` by the title. `SettingsCard` wraps it.
- `List` (`{ label? }`): one `ul` box with dividers. `ListRow` (`{ to?, trailing? }`, `data-*` on the `li`): with `to` one stretched link, `trailing` controls above it. For `href` or `state`, hand-write it.
- `DetailHeader`: `icon` and `tone` (`primary`, `neutral`, `muted`) or `media`; `title` the `h1` (`titleProps`); `badges` (`STATUS_TONE`), `details` (`detailsProps`), `editors`, `actions`, each a `data-region` that renders nothing when empty; `data-*` on the header.
- `ChipGroup`: link chips a `nav` (`aria-current="true"`), button chips a `ul` (`aria-pressed` if toggling).
- `ComboBox`: `options`, a controlled `inputValue`, `onSelect`, `onCreate?` (last), `sections`; the caller filters. `opensOn` `focus` (default) or `typing` (an empty field has no list; typing opens it, clearing closes it: condition, allergy, medication names). `control`: inside a `Field`.
- `TabNav` (`{ label, tabs: [{ label, to, match?, current?, icon?, count?, replace? }] }`): a `nav` of links, not a tablist. A tab claims its path and below (`match` replaces that, `current` overrides both); the first claimant gets `aria-current="page"` from the pending navigation; prefetches. `count` is a badge read in the name. A segmented bar: no padding, gap or per-link rounding; the current fill reaches its edges, the focus ring inside; `accent` tints the current one and the counts (default primary). Equal tabs on phones, `sm:w-fit`; overflow scrolls.
- `Message` (`{ tone, children }`): `error` `role="alert"`, other tones `role="status"`; empty, it stays mounted.
- `Notice` (`{ tone, icon?, action? }`): a soft alert with the tone's icon (or `icon`), role by tone (`role` overrides); `action` a `{ label, to }` link or `{ label, onAction }` button.
- `EmptyState`: a quiet line, an optional action; `icon`, `accent` add a soft circle (main lists only).
- `toast({ message, action?, undo?, timeout? })` → id, `dismissToast(id)`: one at a time, newest first; an action runs once; 6 s (`null` stays); the region loads on the first.
- `Loading` (`{ label, lines? }`): a status named by `label`, a spinner and the label, or with `lines` a `Skeleton` and a screen-reader label. `Skeleton` (`{ lines }`): `aria-hidden` bars, `data-skeleton`.
- `Badge` (`{ tone, icon? }`): one size, soft (`badgeClass`, pure); `neutral`, `primary`, `success`, `warning`, `danger`, `info`. **Status tones** (`STATUS_TONE`): current and now `primary`; past and stopped `neutral`; overdue `danger`; due soon `warning`; done `success`. `ViaTag` stays its own.
- `SearchFilterBar`: search (`?q=`, `lib/core/textFilter.ts`), `FilterMenu`, chips. `Highlight` marks matches (`MARK_CLASS`, `bg-warning`, 5.2:1 in both themes).

## Page, headings and tokens (`/app` only; marketing, print and `/admin` keep theirs)

- `Page` is a page's one `main` (`max-w-2xl`; `width="wide"` `max-w-4xl`), passes `data-*`, `id`, `className`. Every `/app` page but print sheets, the error screen and first sync.
- **Every section page starts with a `PageHeader`** (its `h1` and actions; `description`: one quiet line).
- **Heading scale** (`ui/styles.ts`): `TITLE_PAGE` `text-xl font-semibold`, `TITLE_SECTION` `text-base font-semibold` (sections and cards), `TITLE_SUB` `text-sm font-semibold`.
- **Tokens:** `text-muted` (70%) and `text-faint` (62%, 4.5:1 on light) in `app.css`. `LINK` (`link text-primary-ink`); `text-<tone>-ink` lifts a tone's text to 4.5:1 on every surface. `ui/styles.ts`: `ICON_SM`, `ICON`, `ICON_LG` (`size-3.5`, `4`, `5`), `COUNT_BADGE`, `CHOICE_BUTTON`, `CHOICE_TILE`.

## Bands

- `Page bands` is a `main[data-bands]` with no column; every child is a `Section`: a full-width band, alternating `base-200` and `base-100` from the first by position in CSS, a `base-300` rule above all but the first, `py-6`, an inner `max-w-2xl px-4` column. A `Section` takes `title` (an `h2`, then it's a named `section`), `id` (`data-section`), `actions`, `description`, `aria-label`.
- **Banded pages:** medication, provider, care period, to-do and the profile. The first band holds the `BackLink` and the `DetailHeader`; **each part component is the `Section` itself**, never wrapped, in its order with its role checks and hooks. No cards in a band (list boxes stay). Parts shared with unbanded pages take `band` (`LinkedTodos`, `AllergiesRegion`). Tests read bands with `test/bands.ts`.
