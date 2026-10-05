import type { AnimationDef, SpriteAnchor, AnchorKind } from '../animation/types';
import { characterAnimsFromSheet } from '../animation/characterSheet';

/* ------------------------------------------------------------------ */
/* Sprite anchors (town_atlas). Origin to pass to setOrigin().         */
/* Rule: buildings/props/doors/roofs bottom-centre, tiles/walls/floor  */
/* strips top-left, wall hangings and windows centre.                  */
/* One entry per catalogue key (tests enforce full coverage).          */
/* ------------------------------------------------------------------ */

const a = (x: number, y: number, kind: AnchorKind): SpriteAnchor => ({ x, y, kind });

export const SPRITE_ANCHORS: Readonly<Record<string, SpriteAnchor>> = {
  bank_front: a(0.5, 1, 'bottom-centre'),
  bar_counter: a(0.5, 1, 'bottom-centre'),
  barrel_a: a(0.5, 1, 'bottom-centre'),
  barrel_b: a(0.5, 1, 'bottom-centre'),
  barrel_interior_a: a(0.5, 1, 'bottom-centre'),
  barrel_interior_b: a(0.5, 1, 'bottom-centre'),
  bed: a(0.5, 1, 'bottom-centre'),
  bench: a(0.5, 1, 'bottom-centre'),
  bookshelf_bottles: a(0.5, 1, 'bottom-centre'),
  bottles_a: a(0.5, 0.5, 'centre'),
  cactus_potted: a(0.5, 1, 'bottom-centre'),
  cactus_tall: a(0.5, 1, 'bottom-centre'),
  candelabra: a(0.5, 0.5, 'centre'),
  chair_red: a(0.5, 1, 'bottom-centre'),
  chair_wood: a(0.5, 1, 'bottom-centre'),
  chimney_stone: a(0.5, 1, 'bottom-centre'),
  clock_sign: a(0.5, 0.5, 'centre'),
  cow_skull: a(0.5, 0.5, 'centre'),
  crate_small: a(0.5, 1, 'bottom-centre'),
  crate_stack: a(0.5, 1, 'bottom-centre'),
  crate_stack_b: a(0.5, 1, 'bottom-centre'),
  dirt_patch: a(0.5, 1, 'bottom-centre'),
  door_dark: a(0.5, 1, 'bottom-centre'),
  door_glass: a(0.5, 1, 'bottom-centre'),
  door_jail: a(0.5, 1, 'bottom-centre'),
  door_saloon_swing: a(0.5, 1, 'bottom-centre'),
  door_wood: a(0.5, 1, 'bottom-centre'),
  fence_gate_cross: a(0.5, 1, 'bottom-centre'),
  fence_post: a(0.5, 1, 'bottom-centre'),
  fence_rail: a(0.5, 1, 'bottom-centre'),
  general_store_front: a(0.5, 1, 'bottom-centre'),
  hay_bale: a(0.5, 1, 'bottom-centre'),
  hay_patch_a: a(0.5, 1, 'bottom-centre'),
  hay_patch_b: a(0.5, 1, 'bottom-centre'),
  hay_pile: a(0.5, 1, 'bottom-centre'),
  hitching_post: a(0.5, 1, 'bottom-centre'),
  hitching_rail: a(0.5, 1, 'bottom-centre'),
  jail_front: a(0.5, 1, 'bottom-centre'),
  lamp_post: a(0.5, 1, 'bottom-centre'),
  lantern_hanging: a(0.5, 0, 'top-centre'),
  lasso: a(0.5, 0.5, 'centre'),
  painting_framed: a(0.5, 0.5, 'centre'),
  piano: a(0.5, 1, 'bottom-centre'),
  pillar_a: a(0.5, 1, 'bottom-centre'),
  pillar_b: a(0.5, 1, 'bottom-centre'),
  porch_awning: a(0.5, 1, 'bottom-centre'),
  porch_frame: a(0.5, 1, 'bottom-centre'),
  porch_shed: a(0.5, 1, 'bottom-centre'),
  rail_wood: a(0.5, 1, 'bottom-centre'),
  railing_balcony: a(0.5, 1, 'bottom-centre'),
  rocking_chair: a(0.5, 1, 'bottom-centre'),
  rocks_small: a(0.5, 1, 'bottom-centre'),
  roof_gray_slate: a(0.5, 1, 'bottom-centre'),
  roof_green_shingles: a(0.5, 1, 'bottom-centre'),
  roof_parapet_stone: a(0.5, 1, 'bottom-centre'),
  roof_red_tiles: a(0.5, 1, 'bottom-centre'),
  roof_wood_dark: a(0.5, 1, 'bottom-centre'),
  roof_wood_planks: a(0.5, 1, 'bottom-centre'),
  rug_red: a(0, 0, 'top-left'),
  saddle: a(0.5, 1, 'bottom-centre'),
  safe: a(0.5, 1, 'bottom-centre'),
  saloon_front: a(0.5, 1, 'bottom-centre'),
  section_door_glass: a(0.5, 1, 'bottom-centre'),
  section_general_store: a(0.5, 1, 'bottom-centre'),
  section_jail: a(0.5, 1, 'bottom-centre'),
  section_saloon: a(0.5, 1, 'bottom-centre'),
  section_sheriff: a(0.5, 1, 'bottom-centre'),
  section_station: a(0.5, 1, 'bottom-centre'),
  section_window_glass: a(0.5, 0.5, 'centre'),
  sheriff_front: a(0.5, 1, 'bottom-centre'),
  shrub_green_a: a(0.5, 1, 'bottom-centre'),
  shrub_green_b: a(0.5, 1, 'bottom-centre'),
  side_table_lantern: a(0.5, 1, 'bottom-centre'),
  sign_bank: a(0.5, 0.5, 'centre'),
  sign_jail: a(0.5, 0.5, 'centre'),
  sign_saloon: a(0.5, 0.5, 'centre'),
  sign_sheriff: a(0.5, 0.5, 'centre'),
  sign_stable: a(0.5, 0.5, 'centre'),
  sign_store: a(0.5, 0.5, 'centre'),
  signpost_arm: a(0.5, 0.5, 'centre'),
  signpost_directions: a(0.5, 1, 'bottom-centre'),
  signpost_wood: a(0.5, 1, 'bottom-centre'),
  stable_front: a(0.5, 1, 'bottom-centre'),
  staircase: a(0.5, 1, 'bottom-centre'),
  station_front: a(0.5, 1, 'bottom-centre'),
  stool_red_a: a(0.5, 1, 'bottom-centre'),
  stool_red_b: a(0.5, 1, 'bottom-centre'),
  table_round: a(0.5, 1, 'bottom-centre'),
  table_round_bottle: a(0.5, 1, 'bottom-centre'),
  tile_carpet_red: a(0, 0, 'top-left'),
  tile_carpet_runner: a(0, 0, 'top-left'),
  tile_floor_planks: a(0, 0, 'top-left'),
  tile_sand_a: a(0, 0, 'top-left'),
  tile_sand_wainscot: a(0, 0, 'top-left'),
  tile_stone_wall: a(0, 0, 'top-left'),
  trim_post_short: a(0.5, 1, 'bottom-centre'),
  trim_post_tall_a: a(0.5, 1, 'bottom-centre'),
  trim_post_tall_b: a(0.5, 1, 'bottom-centre'),
  trim_rail_long: a(0, 0, 'top-left'),
  trim_rail_medium: a(0, 0, 'top-left'),
  trim_rail_short: a(0, 0, 'top-left'),
  wagon: a(0.5, 1, 'bottom-centre'),
  wall_pegs: a(0.5, 0.5, 'centre'),
  wall_saloon_lantern: a(0, 0, 'top-left'),
  wall_saloon_painting: a(0, 0, 'top-left'),
  wall_saloon_plain: a(0, 0, 'top-left'),
  wall_saloon_shelf: a(0, 0, 'top-left'),
  wall_saloon_wanted_skull: a(0, 0, 'top-left'),
  water_trough: a(0.5, 1, 'bottom-centre'),
  window_dark_a: a(0.5, 0.5, 'centre'),
  window_dark_b: a(0.5, 0.5, 'centre'),
  window_jail: a(0.5, 0.5, 'centre'),
  window_wood_small: a(0.5, 0.5, 'centre'),
  window_wood_tall: a(0.5, 0.5, 'centre'),
};

export const DEFAULT_ANCHOR: SpriteAnchor = a(0.5, 1, 'bottom-centre');

export function anchorFor(frameKey: string): SpriteAnchor {
  return SPRITE_ANCHORS[frameKey] ?? DEFAULT_ANCHOR;
}

/* ------------------------------------------------------------------ */
/* Placeholder atlas contract (A04 generates atlas 'placeholder').     */
/* ------------------------------------------------------------------ */

export const PLACEHOLDER_ATLAS = 'placeholder';

const charFrames = (p: string): string[] => [
  `${p}_idle_0`, `${p}_idle_1`, `${p}_draw_0`, `${p}_draw_1`, `${p}_aim`,
  `${p}_shoot_0`, `${p}_shoot_1`, `${p}_hit`, `${p}_dead`,
];

export const PLACEHOLDER_FRAMES: readonly string[] = [
  ...charFrames('hero'),
  ...charFrames('enemy'),
  'muzzle_flash_0', 'muzzle_flash_1', 'muzzle_flash_2',
  'bullet',
  'impact_spark_0', 'impact_spark_1', 'impact_spark_2',
  'dust_puff_0', 'dust_puff_1', 'dust_puff_2',
  'ui_exclaim', 'ui_crosshair',
];

/** Placeholder sprites are character-like: feet at bottom-centre; fx/ui centred. */
export const PLACEHOLDER_ANCHORS: Readonly<Record<string, SpriteAnchor>> = Object.fromEntries(
  PLACEHOLDER_FRAMES.map((f) => [
    f,
    /^(hero|enemy)_/.test(f) ? a(0.5, 1, 'bottom-centre') : a(0.5, 0.5, 'centre'),
  ]),
);

/* ------------------------------------------------------------------ */
/* Animation definitions                                               */
/* ------------------------------------------------------------------ */

export function placeholderCharacterDefs(prefix: 'hero' | 'enemy'): AnimationDef[] {
  const atlas = PLACEHOLDER_ATLAS;
  const f = (s: string): string => `${prefix}_${s}`;
  return [
    { key: f('idle'), atlas, frames: [f('idle_0'), f('idle_1')], frameRate: 3, repeat: -1, oneShot: false },
    { key: f('draw'), atlas, frames: [f('draw_0'), f('draw_1')], frameRate: 16, repeat: 0, oneShot: true, next: f('aim') },
    { key: f('aim'), atlas, frames: [f('aim')], frameRate: 1, repeat: 0, oneShot: false },
    { key: f('shoot'), atlas, frames: [f('shoot_0'), f('shoot_1')], frameRate: 14, repeat: 0, oneShot: true, next: f('aim') },
    { key: f('hit'), atlas, frames: [f('hit')], frameRate: 8, repeat: 0, oneShot: true, next: f('idle') },
    { key: f('dead'), atlas, frames: [f('dead')], frameRate: 1, repeat: 0, oneShot: true },
  ];
}

export const FX_ANIMATION_DEFS: readonly AnimationDef[] = [
  { key: 'fx_muzzle_flash', atlas: PLACEHOLDER_ATLAS, frames: ['muzzle_flash_0', 'muzzle_flash_1', 'muzzle_flash_2'], frameRate: 24, repeat: 0, oneShot: true },
  { key: 'fx_impact_spark', atlas: PLACEHOLDER_ATLAS, frames: ['impact_spark_0', 'impact_spark_1', 'impact_spark_2'], frameRate: 20, repeat: 0, oneShot: true },
  { key: 'fx_dust_puff', atlas: PLACEHOLDER_ATLAS, frames: ['dust_puff_0', 'dust_puff_1', 'dust_puff_2'], frameRate: 10, repeat: 0, oneShot: true },
];

export const PLACEHOLDER_ANIMATION_DEFS: readonly AnimationDef[] = [
  ...placeholderCharacterDefs('hero'),
  ...placeholderCharacterDefs('enemy'),
  ...FX_ANIMATION_DEFS,
];

/**
 * Real character sheets (atlas `characters_atlas`, frames `<prefix>_<idle|idle2|aim|shoot|hit|dead>`).
 * Not registered by default: the sheet has not landed (B1). Pass to registerAnimations once it has.
 */
export const CHARACTER_ATLAS = 'characters_atlas';
export const characterDefsFor = (prefix: string): AnimationDef[] => characterAnimsFromSheet(prefix, CHARACTER_ATLAS);

export const ALL_ANIMATION_DEFS: readonly AnimationDef[] = PLACEHOLDER_ANIMATION_DEFS;
