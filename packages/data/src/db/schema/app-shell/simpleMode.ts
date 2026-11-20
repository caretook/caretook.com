import { z } from "zod";
import { VITAL_TYPES } from "../timeline/vitals";

// Simple mode (assistant PRD): a large-type, one-column view of the timeline
// for people who won't learn the whole app. Client-safe.
//
// - Each membership has the owner's default for that member
//   (`care_group_member.simple_mode`) and a lock (`simple_mode_locked`; a
//   lock means simple). Owners and admins set them online
//   (`careGroupMemberService.setMode`).
// - Each user has their own setting (`user.preferences.simpleMode`), and each
//   device a toggle per group; the device decides with `resolveSimpleMode`.
// - The group's four tiles (`care_group.simple_tiles`): learned from use
//   (null, the default), a fixed set, or four picked by an owner or admin.

/** A member's own choice: follow the group's default for them, or always simple or full. */
export const SIMPLE_MODE_SETTINGS = ["group", "simple", "full"] as const;
export type SimpleModeSetting = (typeof SIMPLE_MODE_SETTINGS)[number];
export const DEFAULT_SIMPLE_MODE_SETTING: SimpleModeSetting = "group";

/** How a group's tiles are chosen. */
export const SIMPLE_TILE_MODES = ["learned", "fixed", "custom"] as const;
export type SimpleTileMode = (typeof SIMPLE_TILE_MODES)[number];

/** How many tiles simple mode shows. */
export const SIMPLE_TILE_COUNT = 4;

/** One tile: a kind of entry it opens a short form for, or one vital type's. */
export const simpleTileZSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.enum(["note", "symptom", "dose"]) }),
  z.strictObject({ kind: z.literal("vital"), vitalType: z.enum(VITAL_TYPES) }),
]);
export type SimpleTile = z.infer<typeof simpleTileZSchema>;

/** `care_group.simple_tiles`: learned or fixed carry no tiles; custom carries exactly four. */
export const simpleTilesZSchema = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.enum(["learned", "fixed"]) }),
  z.strictObject({
    mode: z.literal("custom"),
    tiles: z.array(simpleTileZSchema).length(SIMPLE_TILE_COUNT),
  }),
]);
export type SimpleTiles = z.infer<typeof simpleTilesZSchema>;
