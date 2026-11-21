# The UI kit (`apps/web/app/components/ui/`)

The `ui/` primitives and their contracts: part of the components area ([components](components.md) has its layout, rules and component tests; `check-areas.d/components`).

## What's in it

- **Primitives** import nothing from feature folders; **only `ui/` imports `react-aria-components`**: `Menu` (with `SEPARATOR`), `FilterMenu` and `FilterMenuChips`, `Sheet`, `Popover`, `PageHeader`, `TabNav`, `ConfirmDialog` (`useShowModal`), `Field`, `ChipGroup`, `ChipList`, `UserAvatar`, `AvatarStack`, `IconButton`, `Button`, `FormFooter`, `ChoiceGroup`, `BackLink`, `ComboBox`, `Highlight`, `Toast` (`role="status"`, above the tab bar), `ViaTag` ("via X", `data-via`), `Message`, `Notice`, `EmptyState`, `Loading`, `Skeleton`, `Badge`, `Page`.
- `ui/tooltip/` and `ui/date/` (`DateTimeField`) have their own indexes, so the date picker (~42 KB) and tooltip stay off other pages.
- **`ui/plain`**, the light entry: everything without React Aria (`Field`, `FieldControl`, `IconButton`, `ChoiceGroup`, `Button`, `FormFooter`, `TabNav`, `Message`, `Notice`, `EmptyState`, `Loading`, `Skeleton`, `Badge`, `Page`). Light pages (sign-in, the account forms, `/connect`, marketing) import from it, never from `ui` (its chunk carries React Aria); `ui/plain/plain.test.ts` fails on any React Aria import it reaches.
- **Append-only:** the `ui` and `ui/plain` indexes, `ui/styles.ts` and the gallery registry take new lines at the end only.
- **The gallery** `/dev/ui` (`routes/dev/ui/`, web only, 404 in production through `.server/devUi`, as `/dev/mail`): each primitive in both themes with fictional data, one `sections/` file each, listed in `registry.ts`. A new primitive adds its section. **Add a primitive only for a repeated pattern.**
- **Contrast** is measured in component tests with `apps/web/test/contrast.ts` (translucent colours composited over what's behind them).

## Which to use

- **Every labelled form control is a `Field`**; every one-of-a-few choice a `ChoiceGroup` (native radios in a named `radiogroup`; a controlled `value` may be null); **every text button a `Button`**; a form's Cancel and submit a `FormFooter`; every icon-only button an `IconButton` (a required `label`: its name and tooltip; `to` for a look-alike link); a page's back link a `BackLink`.
- **Messages:** an inline error or status line is a `Message`, a box a `Notice`, a "No … yet." line an `EmptyState`, a wait `Loading`, a badge a `Badge`. A line that appeared only on a condition still renders on that condition (tests pick the first `[role=alert]`); the always-mounted empty `Message` is for lines that were always mounted.

## Contracts

- `Button`: `primary`, `default`, `ghost`, `danger`, `dangerQuiet`; `md`, `sm`, `xs`; `block`; `icon`; `busy` with `busyLabel` (disabled, `aria-busy`, text swapped); type `button` unless given. With `to` a router link that looks the same (`replace`, `state`, `prefetch`); with `href` a plain `<a>` for navigations the router doesn't own (`webcal:`, an OAuth start, another site). Classes come from the pure, internal `buttonClass`, which `IconButton`, `TOOL_CIRCLE`, the chips and the date field build on. Solid `danger` only in a confirm or a form whose one job is the destructive act.
- `FormFooter`: Cancel (`{ label, to }` or `{ label, onCancel }`) then the submit `Button` (`submitLabel`, `busy`, `busyLabel`, `submitDisabled`, `danger`); right-aligned, or `align="start"`; a `status` slot.
- `ConfirmDialog`/`useShowModal`: `confirmVariant` `danger` (default) or `primary`; waits for an open menu to close before `showModal()`; Escape closes only the dialog.
- `Sheet` is full screen below `sm` and a centred modal from `sm`, above the tab bar, and returns focus to its opener.
- `Field` gives its control the `id`, `aria-invalid` and `aria-describedby`, and shows an optional `warning` line (never `aria-invalid`) while there's no error. Ids come from `useId`, so browser checks select inputs by `input[name=…]`.
- `ChipGroup`: link chips a `nav` (`aria-current="true"`), button chips a `ul` (`aria-pressed` when they toggle).
- `ComboBox`: `options`, a controlled `inputValue`, `onSelect`, `onCreate?` (last), `sections`; the caller filters.
- `TabNav` (`{ label, tabs: [{ label, to, match?, current?, icon?, count?, replace? }] }`): a `nav` of links, not a tablist. A tab claims its path and below (`match` replaces that, `current` overrides both); the first claimant gets `aria-current="page"` from the pending navigation; prefetches on render. `icon` is hidden from the name; `count` is a small `badge-primary` read in it ("List, 12"). A rounded `base-100` pill (`shadow-sm`; a `base-300` border in dark), `font-medium` tabs, the current one `bg-primary/15` with primary text (dark: primary mixed 55% with white). Equal tabs on phones, `sm:w-fit`; scrolls sideways when the tabs overflow (never the page), keeping the current tab in view. Measured: the current tab's text 6.41:1 light, 6.08 dark; the bar against the page only 1.11 and 1.22 (its edge is the shadow or border).
- `Message` (`{ tone, children }`): `error` is `role="alert"`; `success`, `warning`, `info` (default) `role="status"`. Empty, it stays mounted and takes no space (`empty:hidden`).
- `Notice` (`{ tone, icon?, action? }`): a soft daisyUI alert with the tone's icon (or `icon`); role by tone; `action` a `{ label, to }` link or a `{ label, onAction }` button.
- `EmptyState`: one quiet line and an optional action (a link or a button).
- `Loading` (`{ label, lines? }`): a status named by `label`, a spinner and the label, or with `lines` a `Skeleton` and a screen-reader label. `Skeleton` (`{ lines }`): bars, `aria-hidden`, `data-skeleton`.
- `Badge` (`{ tone, icon? }`): one size, soft (`badgeClass`, pure); `neutral`, `primary`, `success`, `warning`, `danger`, `info`. **Status tones** (`STATUS_TONE`): current and now `primary`; past and stopped `neutral`; overdue `danger`; due soon `warning`; done `success`. `ViaTag` stays its own.
- `Highlight` marks a search's matches (`MARK_CLASS`, `bg-warning`, 5.2:1 in both themes).

## Page, headings and tokens (`/app` only; marketing, print and `/admin` keep theirs)

- `Page` is a page's one `main` (`mx-auto max-w-2xl space-y-4 px-4 py-5`; `width="wide"` is `max-w-4xl`), passing `data-*`, `id` and `className` through. Every `/app` page uses it but the timeline and entry folders, print sheets, the error screen and first sync.
- **Every section page starts with a `PageHeader`** (its `h1` and actions; `description` for one quiet line under the title).
- **Heading scale** (`ui/styles.ts`): `TITLE_PAGE` `text-xl font-semibold` (`PageHeader` uses it), `TITLE_SECTION` `text-base font-semibold` (sections and cards), `TITLE_SUB` `text-sm font-semibold`.
- **Tokens:** `text-muted` (70% of `base-content`) and `text-faint` (62%, the lowest whole step clearing 4.5:1 on the light page) in `app.css`; muted measures 6.24 / 6.57 light and 8.82 / 7.66 dark on `base-200` / `base-100`, faint 4.77 / 4.94 and 7.11 / 6.33. `LINK` (`link link-primary`), `ICON_SM`, `ICON`, `ICON_LG` (`size-3.5`, `4`, `5`) in `ui/styles.ts`.
