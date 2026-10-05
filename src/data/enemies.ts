/**
 * Enemy roster data (A06). Starting values from docs/GAME_DESIGN.md section 7; A18 tunes.
 * All times are milliseconds measured from the CUE (the tell frame) unless noted.
 * RULE F1: every `tell.leadMs` is >= FAIRNESS_FLOOR_MS; difficulty never shortens it.
 */
import type { EnemyId, RegionId } from './dialogue';

export type { EnemyId };

/** RULE F1 floor: tell-to-lethal-shot. Mirrors DUEL_CONFIG.fairness.minLethalMs. */
export const FAIRNESS_FLOOR_MS = 450;
/** Minimum gap between consecutive enemy shots. Mirrors DUEL_CONFIG.fairness.minShotGapMs. */
export const MIN_SHOT_GAP_MS = 250;

export type TellKind =
  | 'hand_twitch_chime' // rookie
  | 'holster_glove_snap' // bandit
  | 'eye_flash_hat_tip' // gunslinger
  | 'whistle_hat_rim' // coward (real); fake is 'shoulder_shake'
  | 'hiccup_bottle_drop' // drunk
  | 'badge_flash_whistle' // sheriff
  | 'double_glint' // dual wielder (left then right)
  | 'lens_glint_ping' // sniper
  | 'wrist_flick_whoosh' // knife thrower
  | 'whistle_shoulder_step' // train guard
  | 'hoofbeat_stirrup_rise' // horse rider
  | 'poster_announced'; // bounty hunter: resolved per duel to one of the above

/** Dodge telegraph shown in the last `dodgeWindowMs` before a shot. */
export type DodgeTellKind =
  | 'muzzle_raise' // gun barrel lifts and flashes (gunslingers)
  | 'double_raise' // left then right barrel lift, one window per shot
  | 'glint_late' // sniper: the lens glint holds, the dodge window opens only at its end
  | 'projectile' // knife leaves the hand and travels; dodge as it crosses
  | 'motion'; // enemy is already moving (circle/sway); the raise lands on a beat of the motion

/**
 * Smallest fair dodge window. Reaction medians in the sim are 210 (expert) to 380 (novice) ms plus
 * about 25 ms display lag and about 40 ms touch latency; 250 ms is reachable by a skilled player on the
 * cue alone and by anyone who anticipates a repeated telegraph. Early enemies (novice median 380) get
 * 380-420 so a reaction dodge works for them.
 */
export const DODGE_MIN_WINDOW_MS = 250;
/** Time after the cue a dodge window may not open before: the player is still answering the cue. */
export const DODGE_MIN_OPEN_AFTER_CUE_MS = 250;

export type Range = readonly [min: number, max: number];

export type Tier = 1 | 2 | 3 | 4 | 5;

export interface FakeTellDef {
  /** Distinct tell shown instead of the real one (F6: distinguishable by shape and pitch). */
  kind: string;
  /** Probability per duel at difficulty 0 and 1. */
  chance: Range;
  /** How long the fake animation plays. */
  durationMs: number;
  /** Quiet time between the end of the fake and the real cue. Never below 400 (correct reaction is never punished). */
  recoverMs: number;
}

export interface EnemyDef {
  id: EnemyId;
  name: string;
  tier: Tier;
  hp: number;
  /** Regions where this enemy appears in the normal pool. */
  regions: readonly RegionId[];
  /** Atlas frame prefix of the real character sheet; use resolveSpritePrefix for the fallback. */
  spritePrefix: string;
  /** True when the real sheet has this character; false means the `enemy` placeholder is used. */
  hasRealSheet: boolean;
  /** WAIT length before the cue (rhythm axis). */
  wait: Range;
  /** Delay between the cue and the enemy starting to draw. */
  reactionMs: Range;
  /** Draw animation length; gun is out at reaction + draw. */
  drawTimeMs: Range;
  tell: {
    kind: TellKind;
    /** Nominal tell-to-lethal time for the first shot. >= FAIRNESS_FLOOR_MS. */
    leadMs: number;
    /** Random extra (never negative) added to leadMs. */
    jitterMs: number;
  };
  /** Aim error px at difficulty 0; hit when <= enemyHitTolerancePx (24). */
  aimErrorPx: Range;
  /** Chance a shot is a wild miss (large error), for erratic enemies. */
  wildMissChance?: number;
  /** Shots in the sequence; later shots are a long reload apart. */
  shots: number;
  /** Delay between consecutive shots in the sequence. */
  shotGapMs: Range;
  fakeTell?: FakeTellDef;
  /**
   * Dodge window of each enemy shot in ms: the telegraph opens at `shotAt - dodgeWindowMs` and a dodge
   * input inside it avoids the shot. Fair range per docs/ENEMY_AI.md: DODGE_MIN_WINDOW_MS .. (lead - 250).
   */
  dodgeWindowMs?: number;
  /** What the player reads to time a dodge (art/sfx key for A02's telegraph). */
  dodgeTell?: DodgeTellKind;
  /** Limb disarms allowed per attempt (QA-09, D19). Default 2; 1 for hp >= 4. A02 consumes via `maxDisarmsFor`. */
  maxDisarms?: number;
  /** Probability the enemy sidesteps a player shot late (coward). Needs DuelSystem support. */
  evadeChance?: number;
  /** Body hits are blocked until a head or gun-arm hit (sheriff). Needs DuelSystem support. */
  armor?: { blocksBody: boolean };
  /** Moving target (horse rider, train guard). Needs DuelSystem support. */
  motion?: { kind: 'circle' | 'sway'; amplitudePx: number; periodMs: number };
  /** Enemy-specific weak point multiplier zone. Needs DuelSystem support. */
  weakPoint?: string;
  /** Bounty hunter: per-duel variant picked by rng and announced on the wanted poster. */
  variants?: readonly EnemyVariant[];
}

export interface EnemyVariant {
  id: string;
  tellKind: TellKind;
  leadMs: number;
  jitterMs: number;
  shots: number;
  shotGapMs: Range;
  fakeTell?: FakeTellDef;
  aimErrorPx?: Range;
}

const DUST: RegionId[] = ['dust_creek'];

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  rookie: {
    id: 'rookie', name: 'Rookie', tier: 1, hp: 1, regions: DUST,
    spritePrefix: 'enemy', hasRealSheet: false,
    wait: [1400, 2600], reactionMs: [120, 220], drawTimeMs: [300, 380],
    tell: { kind: 'hand_twitch_chime', leadMs: 750, jitterMs: 150 },
    aimErrorPx: [4, 40], shots: 1, shotGapMs: [900, 1200],
    dodgeWindowMs: 420, dodgeTell: 'muzzle_raise', maxDisarms: 2,
  },
  bandit: {
    id: 'bandit', name: 'Bandit', tier: 1, hp: 2, regions: ['dust_creek', 'canyon'],
    spritePrefix: 'bandit', hasRealSheet: true,
    wait: [1300, 2800], reactionMs: [90, 170], drawTimeMs: [260, 340],
    tell: { kind: 'holster_glove_snap', leadMs: 740, jitterMs: 140 },
    aimErrorPx: [0, 38], shots: 1, shotGapMs: [650, 850],
    dodgeWindowMs: 380, dodgeTell: 'muzzle_raise', maxDisarms: 2,
    fakeTell: { kind: 'glove_flap_no_snap', chance: [0, 0.3], durationMs: 300, recoverMs: 450 },
  },
  gunslinger: {
    id: 'gunslinger', name: 'Gunslinger', tier: 2, hp: 2, regions: ['dust_creek', 'canyon', 'railroad'],
    spritePrefix: 'gunslinger', hasRealSheet: true,
    wait: [1200, 2900], reactionMs: [70, 130], drawTimeMs: [200, 260],
    // half-beat feint: the first flash is followed by a hold before the shot
    tell: { kind: 'eye_flash_hat_tip', leadMs: 560, jitterMs: 120 },
    aimErrorPx: [0, 30], shots: 1, shotGapMs: [500, 650],
    dodgeWindowMs: 300, dodgeTell: 'muzzle_raise', maxDisarms: 2,
    fakeTell: { kind: 'eye_flash_only', chance: [0.15, 0.45], durationMs: 250, recoverMs: 450 },
  },
  coward: {
    id: 'coward', name: 'Coward', tier: 2, hp: 1, regions: ['dust_creek', 'canyon', 'railroad'],
    spritePrefix: 'enemy', hasRealSheet: false,
    wait: [1500, 3200], reactionMs: [100, 180], drawTimeMs: [280, 360],
    tell: { kind: 'whistle_hat_rim', leadMs: 700, jitterMs: 160 },
    aimErrorPx: [0, 42], shots: 1, shotGapMs: [800, 1000],
    dodgeWindowMs: 380, dodgeTell: 'muzzle_raise', maxDisarms: 2,
    fakeTell: { kind: 'shoulder_shake', chance: [0.5, 0.8], durationMs: 400, recoverMs: 500 },
    evadeChance: 0.5,
  },
  drunk: {
    id: 'drunk', name: 'Drunk', tier: 2, hp: 2, regions: ['saloon', 'dust_creek'],
    spritePrefix: 'enemy', hasRealSheet: false,
    wait: [1000, 3400], reactionMs: [100, 380], drawTimeMs: [280, 460],
    tell: { kind: 'hiccup_bottle_drop', leadMs: 800, jitterMs: 420 },
    aimErrorPx: [4, 46], wildMissChance: 0.4, shots: 1, shotGapMs: [700, 1300],
    dodgeWindowMs: 420, dodgeTell: 'muzzle_raise', maxDisarms: 2,
  },
  sheriff: {
    id: 'sheriff', name: 'Sheriff', tier: 3, hp: 3, regions: ['dust_creek', 'railroad'],
    spritePrefix: 'sheriff', hasRealSheet: true,
    wait: [1400, 2800], reactionMs: [90, 150], drawTimeMs: [240, 310],
    tell: { kind: 'badge_flash_whistle', leadMs: 600, jitterMs: 120 },
    aimErrorPx: [0, 32], shots: 1, shotGapMs: [600, 800],
    dodgeWindowMs: 300, dodgeTell: 'muzzle_raise', maxDisarms: 2,
    armor: { blocksBody: true }, weakPoint: 'badge',
  },
  dual_wielder: {
    id: 'dual_wielder', name: 'Dual Wielder', tier: 4, hp: 2, regions: ['railroad', 'blackwater_bay'],
    spritePrefix: 'dual_wielder', hasRealSheet: true,
    wait: [1500, 3000], reactionMs: [80, 140], drawTimeMs: [240, 320],
    tell: { kind: 'double_glint', leadMs: 640, jitterMs: 120 },
    aimErrorPx: [0, 32], shots: 2, shotGapMs: [380, 520],
    dodgeWindowMs: 280, dodgeTell: 'double_raise', maxDisarms: 2,
  },
  sniper: {
    id: 'sniper', name: 'Sniper', tier: 3, hp: 2, regions: ['canyon', 'widows_peak'],
    spritePrefix: 'sniper', hasRealSheet: true,
    wait: [2000, 3500], reactionMs: [150, 260], drawTimeMs: [200, 300],
    // long, clearly telegraphed glint: precise but slow
    tell: { kind: 'lens_glint_ping', leadMs: 1000, jitterMs: 140 },
    aimErrorPx: [0, 24], shots: 1, shotGapMs: [900, 1200],
    // long glint, dodge window opens late (the last 320 ms of a 1000 ms telegraph)
    dodgeWindowMs: 320, dodgeTell: 'glint_late', maxDisarms: 2,
  },
  knife_thrower: {
    id: 'knife_thrower', name: 'Knife Thrower', tier: 3, hp: 2, regions: ['widows_peak', 'canyon'],
    spritePrefix: 'knife_thrower', hasRealSheet: true,
    wait: [1300, 2800], reactionMs: [90, 150], drawTimeMs: [200, 280],
    // knives are slower than bullets; a second knife follows a failed dodge
    tell: { kind: 'wrist_flick_whoosh', leadMs: 780, jitterMs: 120 },
    aimErrorPx: [0, 30], shots: 2, shotGapMs: [520, 680],
    dodgeWindowMs: 360, dodgeTell: 'projectile', maxDisarms: 2,
  },
  train_guard: {
    id: 'train_guard', name: 'Train Guard', tier: 3, hp: 3, regions: ['railroad'],
    spritePrefix: 'train_guard', hasRealSheet: true,
    wait: [1400, 3000], reactionMs: [100, 170], drawTimeMs: [260, 340],
    tell: { kind: 'whistle_shoulder_step', leadMs: 680, jitterMs: 160 },
    aimErrorPx: [0, 34], shots: 1, shotGapMs: [600, 800],
    dodgeWindowMs: 320, dodgeTell: 'motion', maxDisarms: 2,
    motion: { kind: 'sway', amplitudePx: 18, periodMs: 1400 },
  },
  horse_rider: {
    id: 'horse_rider', name: 'Horse Rider', tier: 3, hp: 2, regions: ['canyon', 'railroad'],
    spritePrefix: 'horse_rider', hasRealSheet: true,
    wait: [1500, 3200], reactionMs: [120, 200], drawTimeMs: [260, 340],
    tell: { kind: 'hoofbeat_stirrup_rise', leadMs: 820, jitterMs: 140 },
    aimErrorPx: [0, 34], shots: 1, shotGapMs: [700, 900],
    dodgeWindowMs: 340, dodgeTell: 'motion', maxDisarms: 2,
    motion: { kind: 'circle', amplitudePx: 60, periodMs: 2200 },
  },
  bounty_hunter: {
    id: 'bounty_hunter', name: 'Bounty Hunter', tier: 5, hp: 4, regions: ['dust_creek', 'goldspire'],
    spritePrefix: 'enemy', hasRealSheet: false,
    wait: [1500, 3200], reactionMs: [70, 130], drawTimeMs: [200, 280],
    tell: { kind: 'poster_announced', leadMs: 600, jitterMs: 120 },
    aimErrorPx: [0, 28], shots: 1, shotGapMs: [500, 700],
    dodgeWindowMs: 280, dodgeTell: 'muzzle_raise', maxDisarms: 1,
    variants: [
      {
        id: 'feint', tellKind: 'eye_flash_hat_tip', leadMs: 560, jitterMs: 120, shots: 1, shotGapMs: [500, 650],
        fakeTell: { kind: 'eye_flash_only', chance: [0.3, 0.6], durationMs: 250, recoverMs: 450 },
      },
      { id: 'glint', tellKind: 'lens_glint_ping', leadMs: 950, jitterMs: 120, shots: 1, shotGapMs: [800, 1000], aimErrorPx: [0, 22] },
      { id: 'dual', tellKind: 'double_glint', leadMs: 640, jitterMs: 100, shots: 2, shotGapMs: [380, 500] },
    ],
  },
};

export const ENEMY_LIST: readonly EnemyDef[] = Object.values(ENEMIES);

export function getEnemyDef(id: string): EnemyDef {
  const d = (ENEMIES as Record<string, EnemyDef | undefined>)[id];
  if (!d) throw new Error(`Unknown enemy id: ${id}`);
  return d;
}

/** Enemies that may appear in a region, sorted by tier. */
export function enemiesForRegion(region: RegionId): EnemyDef[] {
  return ENEMY_LIST.filter((e) => e.regions.includes(region)).sort((a, b) => a.tier - b.tier);
}

/**
 * Sprite prefix to render: the real character sheet prefix when it exists in the
 * atlas, else the `enemy` placeholder. `has` answers "does the atlas have `<prefix>_idle`".
 */
export function resolveSpritePrefix(def: EnemyDef, has: (prefix: string) => boolean = () => false): string {
  return def.hasRealSheet && has(def.spritePrefix) ? def.spritePrefix : 'enemy';
}

/** Depth difficulty adds an hp tier at the top end (GAME_DESIGN "Scaling by depth"). */
export function enemyHpFor(def: EnemyDef, difficulty: number): number {
  return def.hp + (difficulty >= 0.75 && def.hp < 4 ? 1 : 0);
}

/** Effective disarm cap for an enemy at a difficulty (D19): the data cap, forced to 1 once effective hp >= 4. */
export function maxDisarmsFor(def: EnemyDef, difficulty: number): number {
  const cap = def.maxDisarms ?? 2;
  return enemyHpFor(def, difficulty) >= 4 ? Math.min(cap, 1) : cap;
}
