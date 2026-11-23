# The UI kit (`apps/web/app/components/ui/`)

The `ui/` primitives' contracts; layout, rules and tests are in [components](components.md).

## What's in it

- **Primitives** (the `ui` index) import nothing from feature folders; **only `ui/` imports React Aria** (lint).
- `ui/tooltip/` and `ui/date/` (`DateTimeField`; hour arrows cross AM/PM) have their own indexes, to stay off other pages.
- **`ui/plain`**, the light entry: everything without React Aria. Light pages (sign-in, the account forms, `/connect`, marketing) import from it, never from `ui` (its chunk carries React Aria); `ui/plain/plain.test.ts` fails on any React Aria import it reaches.
- **Append-only:** the `ui` and `ui/plain` indexes, `ui/styles.ts` and the gallery registry take new lines at the end only.
- **The gallery** `/dev/ui` (`routes/dev/ui/`, web only, 404 in production): each primitive in both themes with fictional data, one `sections/` file each, listed in `registry.ts` (and Type). A new primitive adds its section. **Add a primitive only for a repeated pattern.**
- **Contrast** is measured in component tests with `apps/web/test/contrast.ts` (translucent colours composited).

## Which to use

- **Every labelled form control is a `Field`** (pass `kind` and it owns the control's classes; only `ChoiceGroup` callers style a control); checkboxes and switches are `CheckField` and `ToggleField`; a card is a `Card`, a list box a `List` of `ListRow`s; every one-of-a-few choice a `ChoiceGroup` (native radios in a named `radiogroup`; a controlled `value` may be null); **every button a `Button`** (icon only: `icon` and a required `label`, its name and tooltip; `IconButton` is its ghost `sm` form); a form's Cancel and submit a `FormFooter`; a page's back link a `BackLink`; a question with two or three answers a `ChoiceDialog`; an expander a `Chevron` and a `Collapse`. Not a `Button`: navigation bars, marketing's header and footer links, expand toggles, `Menu` triggers, inline links, tabs, chips, row links, menu items, form controls, the date picker's insides, avatars.
- **Messages:** an inline error or status line is a `Message`, a box a `Notice`, a "No … yet." line an `EmptyState`, a wait `Loading`, a badge a `Badge`.

## Contracts

- `Button`: `variant` `primary`, `secondary` (default), `ghost`, `danger`, `dangerQuiet`; `size` `lg`, `md`, `sm`, `xs`; `shape` `rounded` (default), `pill`, `square`, `round`; `block`; `icon`. Icon only is `square` unless shaped; a button takes `pressed` (the toggle look, in place of the variant), `expanded`, `controls`, `ref`. `busy` with `busyLabel` (disabled, `aria-busy`, text swapped); type `button` unless given. With `to` a router link that looks the same (`replace`, `state`, `prefetch`, `preventScrollReset`); with `href` a plain `<a>` for navigations the router doesn't own. Classes come from the pure `buttonClass` (it takes `pressed` too), which `TOOL_CIRCLE`, the chips, the date field and `Menu`'s trigger build on.
- `Menu`'s trigger takes a look (`variant`, `size`, `shape`; no default shape) through `buttonClass`; a bare class string still works until `ui-kit-4`. Solid `danger` only in a confirm or a form whose one job is the destructive act.
- `FormFooter`: Cancel (`{ label, to }` or `{ label, onCancel }`) then the submit `Button` (`submitLabel`, `busy`, `busyLabel`, `submitDisabled`, `danger`); right-aligned, or `align="start"`; a `status` slot.
- `ConfirmDialog`/`useShowModal`: `confirmVariant` `danger` (default) or `primary`; waits for an open menu to close before `showModal()`; Escape closes only the dialog.
- `ChoiceDialog` (`open`, `title`, `message`, up to three `choices` `{ id, label, tone, data-* }`, `cancelLabel`, `onChoose(id)`, `onClose`, `data-*` on the dialog): `ConfirmDialog`'s rules; choices stacked full width, then Cancel; `onClose` runs on every close.
- `PageHeader` `icon`, `accent`: a soft chip before the title. `add`: a `label` and a link (`to` and its options), `onPress`, or `items` (`menuLabel`); a primary `sm` icon-only `+`, the header's last control, `actions` before it; `data-*` on it.
- `Chevron` (`open`, `closed` `right`|`down`; hidden). `Collapse` (`open`, `id`, `axis` `block`|`inline`): closed is inert and hidden but mounted; the caller's toggle keeps `aria-expanded`, `aria-controls`.
- `Sheet` is full screen below `sm`, a centred modal from it, above the tab bar, and returns focus to its opener (from a `Menu` item: its button). Close, Escape and a tap outside play the exit (`useSheetExit`). The topmost sheet holds a path change for the exit (not a search or hash change, a submission or reduced motion); closing it sends a held navigation at once. A save plays the exit when its caller navigates, not when an action redirects. `guardChanges`: a changed form asks "Discard changes?" on those or Back.
- **Accents** (`ui/accents.ts`, pure): `ACCENTS` (indigo, teal, orange, lime, plum, pink) and `accentClass(accent | "neutral", "solid" | "soft" | "text")` over the `--color-hue-*` tokens; nothing else names one, and none is a status colour. `IconChip` (`icon`, `accent`, `look`, `size`, `shape`, `label`) is hidden from the accessibility tree unless labelled.
- `Field` gives its control the `id`, `aria-invalid` and `aria-describedby`, and shows an optional `warning` line (never `aria-invalid`) while there's no error. Ids come from `useId`, so browser checks select inputs by `input[name=…]`.
- `Field` `kind` (`input`, `select`, `textarea`): the control gets `<kind> w-full`, plus `<kind>-error` with an error (pure `fieldControlClass`); a `className` after the spread replaces it.
- `CheckField`, `ToggleField` (the input's props plus `label`, `help?`, `error?`): a native checkbox (the toggle `role="switch"`, one size), its label beside it toggling it, help and error as its description (`aria-invalid` on error), `data-*` on the input; an `aria-label` names it instead and hides the visible label.
- `Card` (`{ id?, title?, headingId?, actions? }`): `base-100`, one body gap (`gap-3`); titled, a `section` named by its `h2` (`TITLE_SECTION`) with `data-section` and `actions` beside the title. `SettingsCard` wraps it.
- `List` (`{ label? }`): one `ul` box, `base-300` border and dividers. `ListRow` (`{ to?, trailing? }`, `data-*` on the `li`): with `to` one stretched link, `trailing` controls above it.
- `DetailHeader`: `icon` and `tone` (`primary`, `neutral`, `muted`) or `media`; `title` the `h1` (`titleProps`); `badges` (`STATUS_TONE`), `details` (`detailsProps`), `editors`, `actions`, each a `data-region` that renders nothing when empty; `data-*` on the header.
- `ChipGroup`: link chips a `nav` (`aria-current="true"`), button chips a `ul` (`aria-pressed` when they toggle).
- `ComboBox`: `options`, a controlled `inputValue`, `onSelect`, `onCreate?` (last), `sections`; the caller filters.
- `TabNav` (`{ label, tabs: [{ label, to, match?, current?, icon?, count?, replace? }] }`): a `nav` of links, not a tablist. A tab claims its path and below (`match` replaces that, `current` overrides both); the first claimant gets `aria-current="page"` from the pending navigation; prefetches on render. `count` is a badge read in the name. A rounded pill; `accent` tints the current one and the counts (default primary). Equal tabs on phones, `sm:w-fit`; overflow scrolls sideways, keeping the current tab in view.
- `Message` (`{ tone, children }`): `error` is `role="alert"`; `success`, `warning`, `info` (default) `role="status"`. Empty, it stays mounted (`empty:hidden`).
- `Notice` (`{ tone, icon?, action? }`): a soft daisyUI alert with the tone's icon (or `icon`); role by tone; `action` a `{ label, to }` link or a `{ label, onAction }` button.
- `EmptyState`: one quiet line and an optional action; `icon`, `accent` add a soft circle above it (main lists only). `Toast` takes `open`; it stays, inert, through its fade.
- `Loading` (`{ label, lines? }`): a status named by `label`, a spinner and the label, or with `lines` a `Skeleton` and a screen-reader label. `Skeleton` (`{ lines }`): bars, `aria-hidden`, `data-skeleton`.
- `Badge` (`{ tone, icon? }`): one size, soft (`badgeClass`, pure); `neutral`, `primary`, `success`, `warning`, `danger`, `info`. **Status tones** (`STATUS_TONE`): current and now `primary`; past and stopped `neutral`; overdue `danger`; due soon `warning`; done `success`. `ViaTag` stays its own.
- `Highlight` marks a search's matches (`MARK_CLASS`, `bg-warning`, 5.2:1 in both themes).

## Page, headings and tokens (`/app` only; marketing, print and `/admin` keep theirs)

- `Page` is a page's one `main` (`mx-auto max-w-2xl space-y-4 px-4 py-5`; `width="wide"` is `max-w-4xl`), passing `data-*`, `id` and `className` through. Every `/app` page uses it but the timeline and entry folders, print sheets, the error screen and first sync.
- **Every section page starts with a `PageHeader`** (its `h1` and actions; `description` for one quiet line under the title).
- **Heading scale** (`ui/styles.ts`): `TITLE_PAGE` `text-xl font-semibold` (`PageHeader` uses it), `TITLE_SECTION` `text-base font-semibold` (sections and cards), `TITLE_SUB` `text-sm font-semibold`.
- **Tokens:** `text-muted` (70%) and `text-faint` (62%, still 4.5:1 on the light page) in `app.css`. `LINK` (`link text-primary-ink`); `text-<tone>-ink` lifts a tone's text to 4.5:1 on every surface, `ICON_SM`, `ICON`, `ICON_LG` (`size-3.5`, `4`, `5`) in `ui/styles.ts`.

## Bands

- `Page bands` is a `main[data-bands]` with no column; every child is a `Section`: a full-width band, alternating `base-200` and `base-100` from the first by position in CSS, a `base-300` rule above all but the first, `py-6`, an inner `max-w-2xl px-4` column. A `Section` takes `title` (an `h2`, then it's a named `section`), `id` (`data-section`), `actions`, `description`, `aria-label`.
- **Banded pages:** medication, provider, care period, to-do and the profile. The first band holds the `BackLink` and the `DetailHeader`; **each part component is the `Section` itself**, never wrapped, in its order with its role checks and hooks. No cards in a band (list boxes stay). Parts shared with unbanded pages take `band` (`LinkedTodos`, `AllergiesRegion`). Tests read bands with `apps/web/test/bands.ts`.
