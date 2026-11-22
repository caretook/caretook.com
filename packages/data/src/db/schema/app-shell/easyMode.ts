import { z } from "zod";
import { VITAL_TYPES } from "../timeline/vitals";

// Easy mode (assistant PRD): a large-type, one-column view of the timeline
// for people who won't learn the whole app. Client-safe.
//
// - The easy roles (Easy helper, Easy viewer) always get it and can't leave.
// - Everyone else has their own setting (`user.preferences.easyMode`), and
//   each device a toggle per group; the device decides with `resolveEasyMode`.
// - The group's four tiles (`care_group.easy_tiles`): learned from use
//   (null, the default), a fixed set, or four picked by an owner or admin.

/** A member's own choice: easy or full (a stored `group`, from before the easy roles, reads as full). */
export const EASY_MODE_SETTINGS = ["easy", "full"] as const;
export type EasyModeSetting = (typeof EASY_MODE_SETTINGS)[number];
export const DEFAULT_EASY_MODE_SETTING: EasyModeSetting = "full";

/** How a group's tiles are chosen. */
export const EASY_TILE_MODES = ["learned", "fixed", "custom"] as const;
export type EasyTileMode = (typeof EASY_TILE_MODES)[number];

/** How many tiles easy mode shows. */
export const EASY_TILE_COUNT = 4;

/** One tile: a kind of entry it opens a short form for, or one vital type's. */
export const easyTileZSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.enum(["note", "symptom", "dose"]) }),
  z.strictObject({ kind: z.literal("vital"), vitalType: z.enum(VITAL_TYPES) }),
]);
export type EasyTile = z.infer<typeof easyTileZSchema>;

/** `care_group.easy_tiles`: learned or fixed carry no tiles; custom carries exactly four. */
export const easyTilesZSchema = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.enum(["learned", "fixed"]) }),
  z.strictObject({
    mode: z.literal("custom"),
    tiles: z.array(easyTileZSchema).length(EASY_TILE_COUNT),
  }),
]);
export type EasyTiles = z.infer<typeof easyTilesZSchema>;
