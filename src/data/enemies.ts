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
  /** Dodge window of the enemy's shot, from its muzzle-raise (GAME_DESIGN: default 250). */
  dodgeWindowMs?: number;
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
    tell: { kind: 'hand_twitch_chime', leadMs: 900, jitterMs: 150 },
    aimErrorPx: [10, 70], shots: 1, shotGapMs: [900, 1200],
  },
  bandit: {
    id: 'bandit', name: 'Bandit', tier: 1, hp: 2, regions: ['dust_creek', 'canyon'],
    spritePrefix: 'bandit', hasRealSheet: true,
    wait: [1300, 2800], reactionMs: [90, 170], drawTimeMs: [260, 340],
    tell: { kind: 'holster_glove_snap', leadMs: 620, jitterMs: 140 },
    aimErrorPx: [0, 38], shots: 1, shotGapMs: [650, 850],
    fakeTell: { kind: 'glove_flap_no_snap', chance: [0, 0.3], durationMs: 300, recoverMs: 450 },
  },
  gunslinger: {
    id: 'gunslinger', name: 'Gunslinger', tier: 2, hp: 2, regions: ['dust_creek', 'canyon', 'railroad'],
    spritePrefix: 'gunslinger', hasRealSheet: true,
    wait: [1200, 2900], reactionMs: [70, 130], drawTimeMs: [200, 260],
    // half-beat feint: the first flash is followed by a hold before the shot
    tell: { kind: 'eye_flash_hat_tip', leadMs: 560, jitterMs: 120 },
    aimErrorPx: [0, 30], shots: 1, shotGapMs: [500, 650],
    fakeTell: { kind: 'eye_flash_only', chance: [0.15, 0.45], durationMs: 250, recoverMs: 450 },
  },
  coward: {
    id: 'coward', name: 'Coward', tier: 2, hp: 1, regions: ['dust_creek', 'canyon', 'railroad'],
    spritePrefix: 'enemy', hasRealSheet: false,
    wait: [1500, 3200], reactionMs: [100, 180], drawTimeMs: [280, 360],
    tell: { kind: 'whistle_hat_rim', leadMs: 700, jitterMs: 160 },
    aimErrorPx: [0, 42], shots: 1, shotGapMs: [800, 1000],
    fakeTell: { kind: 'shoulder_shake', chance: [0.5, 0.8], durationMs: 400, recoverMs: 500 },
    evadeChance: 0.5,
  },
  drunk: {
    id: 'drunk', name: 'Drunk', tier: 2, hp: 2, regions: ['saloon', 'dust_creek'],
    spritePrefix: 'enemy', hasRealSheet: false,
    wait: [1000, 3400], reactionMs: [100, 380], drawTimeMs: [280, 460],
    tell: { kind: 'hiccup_bottle_drop', leadMs: 800, jitterMs: 420 },
    aimErrorPx: [4, 46], wildMissChance: 0.4, shots: 1, shotGapMs: [700, 1300],
  },
  sheriff: {
    id: 'sheriff', name: 'Sheriff', tier: 3, hp: 3, regions: ['dust_creek', 'railroad'],
    spritePrefix: 'sheriff', hasRealSheet: true,
    wait: [1400, 2800], reactionMs: [90, 150], drawTimeMs: [240, 310],
    tell: { kind: 'badge_flash_whistle', leadMs: 600, jitterMs: 120 },
    aimErrorPx: [0, 32], shots: 1, shotGapMs: [600, 800],
    armor: { blocksBody: true }, weakPoint: 'badge',
  },
  dual_wielder: {
    id: 'dual_wielder', name: 'Dual Wielder', tier: 4, hp: 2, regions: ['railroad', 'blackwater_bay'],
    spritePrefix: 'dual_wielder', hasRealSheet: true,
    wait: [1500, 3000], reactionMs: [80, 140], drawTimeMs: [240, 320],
    tell: { kind: 'double_glint', leadMs: 640, jitterMs: 120 },
    aimErrorPx: [0, 32], shots: 2, shotGapMs: [380, 520],
    dodgeWindowMs: 250,
  },
  sniper: {
    id: 'sniper', name: 'Sniper', tier: 3, hp: 2, regions: ['canyon', 'widows_peak'],
    spritePrefix: 'sniper', hasRealSheet: true,
    wait: [2000, 3500], reactionMs: [150, 260], drawTimeMs: [200, 300],
    // long, clearly telegraphed glint: precise but slow
    tell: { kind: 'lens_glint_ping', leadMs: 1000, jitterMs: 140 },
    aimErrorPx: [0, 24], shots: 1, shotGapMs: [900, 1200],
    dodgeWindowMs: 250,
  },
  knife_thrower: {
    id: 'knife_thrower', name: 'Knife Thrower', tier: 3, hp: 2, regions: ['widows_peak', 'canyon'],
    spritePrefix: 'knife_thrower', hasRealSheet: true,
    wait: [1300, 2800], reactionMs: [90, 150], drawTimeMs: [200, 280],
    // knives are slower than bullets; a second knife follows a failed dodge
    tell: { kind: 'wrist_flick_whoosh', leadMs: 780, jitterMs: 120 },
    aimErrorPx: [0, 30], shots: 2, shotGapMs: [520, 680],
    dodgeWindowMs: 250,
  },
  train_guard: {
    id: 'train_guard', name: 'Train Guard', tier: 3, hp: 3, regions: ['railroad'],
    spritePrefix: 'train_guard', hasRealSheet: true,
    wait: [1400, 3000], reactionMs: [100, 170], drawTimeMs: [260, 340],
    tell: { kind: 'whistle_shoulder_step', leadMs: 680, jitterMs: 160 },
    aimErrorPx: [0, 34], shots: 1, shotGapMs: [600, 800],
    motion: { kind: 'sway', amplitudePx: 18, periodMs: 1400 },
  },
  horse_rider: {
    id: 'horse_rider', name: 'Horse Rider', tier: 3, hp: 2, regions: ['canyon', 'railroad'],
    spritePrefix: 'horse_rider', hasRealSheet: true,
    wait: [1500, 3200], reactionMs: [120, 200], drawTimeMs: [260, 340],
    tell: { kind: 'hoofbeat_stirrup_rise', leadMs: 820, jitterMs: 140 },
    aimErrorPx: [0, 34], shots: 1, shotGapMs: [700, 900],
    motion: { kind: 'circle', amplitudePx: 60, periodMs: 2200 },
  },
  bounty_hunter: {
    id: 'bounty_hunter', name: 'Bounty Hunter', tier: 5, hp: 4, regions: ['dust_creek', 'goldspire'],
    spritePrefix: 'enemy', hasRealSheet: false,
    wait: [1500, 3200], reactionMs: [70, 130], drawTimeMs: [200, 280],
    tell: { kind: 'poster_announced', leadMs: 600, jitterMs: 120 },
    aimErrorPx: [0, 28], shots: 1, shotGapMs: [500, 700],
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
