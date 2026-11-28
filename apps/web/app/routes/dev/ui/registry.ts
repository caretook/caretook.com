import type { ComponentType } from "react";

import { AvatarStackSection } from "./sections/AvatarStackSection";
import { BackLinkSection } from "./sections/BackLinkSection";
import { ButtonSection } from "./sections/ButtonSection";
import { ChipGroupSection } from "./sections/ChipGroupSection";
import { ChipListSection } from "./sections/ChipListSection";
import { ChoiceGroupSection } from "./sections/ChoiceGroupSection";
import { ComboBoxSection } from "./sections/ComboBoxSection";
import { ConfirmDialogSection } from "./sections/ConfirmDialogSection";
import { DateTimeFieldSection } from "./sections/DateTimeFieldSection";
import { FieldSection } from "./sections/FieldSection";
import { FilterMenuSection } from "./sections/FilterMenuSection";
import { FormFooterSection } from "./sections/FormFooterSection";
import { HighlightSection } from "./sections/HighlightSection";
import { IconButtonSection } from "./sections/IconButtonSection";
import { MenuSection } from "./sections/MenuSection";
import { PageSection } from "./sections/PageSection";
import { PageHeaderSection } from "./sections/PageHeaderSection";
import { PopoverSection } from "./sections/PopoverSection";
import { SheetSection } from "./sections/SheetSection";
import { TabNavSection } from "./sections/TabNavSection";
import { TokensSection } from "./sections/TokensSection";
import { ToastSection } from "./sections/ToastSection";
import { TooltipSection } from "./sections/TooltipSection";
import { UserAvatarSection } from "./sections/UserAvatarSection";
import { ViaTagSection } from "./sections/ViaTagSection";
import { MessageSection } from "./sections/MessageSection";
import { NoticeSection } from "./sections/NoticeSection";
import { EmptyStateSection } from "./sections/EmptyStateSection";
import { LoadingSection } from "./sections/LoadingSection";
import { BadgeSection } from "./sections/BadgeSection";
import { CardSection } from "./sections/CardSection";
import { ListSection } from "./sections/ListSection";
import { CheckFieldSection } from "./sections/CheckFieldSection";
import { ToggleFieldSection } from "./sections/ToggleFieldSection";
import { DetailHeaderSection } from "./sections/DetailHeaderSection";
import { SectionBandsSection } from "./sections/SectionBandsSection";
import { TypeSection } from "./sections/TypeSection";
import { ChoiceDialogSection } from "./sections/ChoiceDialogSection";
import { MotionSection } from "./sections/MotionSection";
import { IconChipSection } from "./sections/IconChipSection";
import { TimeSelectSection } from "./sections/TimeSelectSection";
import { PageLoadingSection } from "./sections/PageLoadingSection";
import { FormTabsSection } from "./sections/FormTabsSection";
import { SwatchSection } from "./sections/SwatchSection";

/** One gallery section: a primitive's variants, with fictional data. */
export type GallerySection = { id: string; title: string; Section: ComponentType };

// The gallery's sections in page order. Append-only: a slice that builds a
// primitive adds its section (its own file in sections/) as one line at the
// end, and never reorders the rest.
export const GALLERY: readonly GallerySection[] = [
  { id: "menu", title: "Menu", Section: MenuSection },
  { id: "filter-menu", title: "FilterMenu", Section: FilterMenuSection },
  { id: "sheet", title: "Sheet", Section: SheetSection },
  { id: "popover", title: "Popover", Section: PopoverSection },
  { id: "confirm-dialog", title: "ConfirmDialog", Section: ConfirmDialogSection },
  { id: "field", title: "Field", Section: FieldSection },
  { id: "choice-group", title: "ChoiceGroup", Section: ChoiceGroupSection },
  { id: "chip-group", title: "ChipGroup", Section: ChipGroupSection },
  { id: "chip-list", title: "ChipList", Section: ChipListSection },
  { id: "icon-button", title: "IconButton", Section: IconButtonSection },
  { id: "back-link", title: "BackLink", Section: BackLinkSection },
  { id: "page-header", title: "PageHeader", Section: PageHeaderSection },
  { id: "tab-nav", title: "TabNav", Section: TabNavSection },
  { id: "user-avatar", title: "UserAvatar", Section: UserAvatarSection },
  { id: "avatar-stack", title: "AvatarStack", Section: AvatarStackSection },
  { id: "combo-box", title: "ComboBox", Section: ComboBoxSection },
  { id: "toast", title: "Toast", Section: ToastSection },
  { id: "via-tag", title: "ViaTag", Section: ViaTagSection },
  { id: "highlight", title: "Highlight", Section: HighlightSection },
  { id: "date-time-field", title: "DateTimeField", Section: DateTimeFieldSection },
  { id: "tooltip", title: "Tooltip", Section: TooltipSection },
  // ui-kit: each slice appends its primitives' sections below.
  { id: "button", title: "Button", Section: ButtonSection },
  { id: "form-footer", title: "FormFooter", Section: FormFooterSection },
  { id: "message", title: "Message", Section: MessageSection },
  { id: "notice", title: "Notice", Section: NoticeSection },
  { id: "empty-state", title: "EmptyState", Section: EmptyStateSection },
  { id: "loading", title: "Loading and Skeleton", Section: LoadingSection },
  { id: "badge", title: "Badge", Section: BadgeSection },
  { id: "page", title: "Page", Section: PageSection },
  { id: "tokens", title: "Tokens and the heading scale", Section: TokensSection },
  { id: "card", title: "Card", Section: CardSection },
  { id: "list", title: "List and ListRow", Section: ListSection },
  { id: "check-field", title: "CheckField", Section: CheckFieldSection },
  { id: "toggle-field", title: "ToggleField", Section: ToggleFieldSection },
  { id: "detail-header", title: "DetailHeader", Section: DetailHeaderSection },
  { id: "section", title: "Section (a banded Page)", Section: SectionBandsSection },
  { id: "type", title: "Type", Section: TypeSection },
  { id: "choice-dialog", title: "ChoiceDialog", Section: ChoiceDialogSection },
  // ui-kit-2 (slice 5): motion.
  { id: "motion", title: "Motion", Section: MotionSection },
  // ui-kit-3 (slice 2): the accents and the icon chip.
  { id: "icon-chip", title: "IconChip and the accents", Section: IconChipSection },
  // fixes-ui (slice 13): the hour-first time picker.
  { id: "time-select", title: "TimeSelect", Section: TimeSelectSection },
  // fixes-ui (slice 92): the full-page loader inside the /app frame.
  { id: "page-loading", title: "PageLoading", Section: PageLoadingSection },
  // fixes-ui (slice 95): form tabs, in the page tabs' look (B-694).
  { id: "form-tabs", title: "FormTabs", Section: FormTabsSection },
  // tags-3 (slice 2): the round swatch choice, moved out of the avatar card.
  { id: "swatch", title: "Swatch and SwatchGroup", Section: SwatchSection },
];
