import { groupHome, segment } from "../core/urls";

/** The recipient's profile's edit sheets, in the order the page shows them (`…/profile/<sheet>`). */
export const PROFILE_SHEETS = ["basics", "contact", "insurance", "emergency"] as const;
export type ProfileSheet = (typeof PROFILE_SHEETS)[number];
const isProfileSheet = (sheet: unknown): sheet is ProfileSheet =>
  (PROFILE_SHEETS as readonly unknown[]).includes(sheet);

export const profileUrls = {
  /**
   * The care recipient's profile (not a group section), or one of its edit
   * sheets over it. An unknown sheet is dropped (the profile).
   */
  profile: (groupId: string, sheet?: ProfileSheet) =>
    `${groupHome(groupId)}/profile${isProfileSheet(sheet) ? `/${sheet}` : ""}`,
  /** The recipient's printable emergency sheet (a page, not a sheet over the profile). */
  profilePrint: (groupId: string) => `${groupHome(groupId)}/profile/print`,
  /** The add-a-condition sheet over the profile (conditions). */
  newCondition: (groupId: string) => `${groupHome(groupId)}/profile/conditions/new`,
  /** One condition's sheet over the profile. */
  condition: (groupId: string, conditionId: string) =>
    `${groupHome(groupId)}/profile/conditions/${segment(conditionId)}`,
  /** A condition's edit sheet over the profile. */
  editCondition: (groupId: string, conditionId: string) =>
    `${groupHome(groupId)}/profile/conditions/${segment(conditionId)}/edit`,
} as const;
