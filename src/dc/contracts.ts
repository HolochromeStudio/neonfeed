// Dust Creek: The Last Draw — contracts between engine (src/dc/engine), data (src/dc/data),
// rendering (src/dc/render) and UI/scenes (src/dc/ui, src/dc/scenes). Types only: no runtime code.
// Owner: Lead (A01). Changes need Lead approval; additive optional fields are fine.

export const DC_WIDTH = 390;
export const DC_HEIGHT = 844;

export type DuelPhase = 'INTRO' | 'STANDOFF' | 'WARNING' | 'DRAW' | 'REACTION' | 'RESOLUTION' | 'REWARD';
export type HeroState = 'IDLE' | 'PREPARING' | 'DRAWING' | 'AIMING' | 'SHOOTING' | 'DODGING' | 'HIT' | 'DEAD';
export type Grade = 'EXCELLENT' | 'GREAT' | 'GOOD' | 'SLOW';
export type Rarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
export type ArenaId = 'dust_creek' | 'canyon' | 'railroad';
export type EnemyId = 'rookie' | 'coward' | 'drunk' | 'elite_bounty_hunter';
export type BossId = 'mad_dog_mcgraw' | 'undertaker' | 'lady_luck' | 'el_diablo';
export type OpponentId = EnemyId | BossId;
export type WeaponId = 'starter_revolver' | 'quickdraw_six' | 'ironhammer' | 'golden_eagle' | 'ghost_barrel';
export type DuelOutcome = 'WIN' | 'LOSE' | 'FALSE_START_LOSS';

/** Pack animation keys. Heroes/enemies/bosses use the frame names from manifest.json `animations`. */
export type FrameKey = string;

export interface WeaponDef {
  id: WeaponId;
  name: string;
  damage: number;
  /** 0..1 chance a landed-timing shot hits. */
  accuracy: number;
  /** Multiplier on the player's own draw time (lower = faster). */
  drawSpeed: number;
  criticalChance: number;
  /** ms before the next shot is possible. */
  reloadTime: number;
  price: number;
  /** Registry key in PACK_ASSETS (ui.icons) or a labelled generated asset. */
  icon: string;
  unlockedByDefault: boolean;
}

export interface EnemyDef {
  id: OpponentId;
  name: string;
  intro: string;
  hp: number;
  /** Opponent reaction time range in ms after DRAW (inclusive). */
  reactionMs: [number, number];
  /** Probability their shot hits when it lands. */
  accuracy: number;
  damage: number;
  /** Warning (tell) duration range in ms. */
  warningMs: [number, number];
  /** Coward-style fake draws: probability and how long the fake lasts. */
  fakeDrawChance?: number;
  fakeDrawMs?: number;
  /** Probability of an erratic extra delay or a lucky shot (Drunk). */
  erraticMs?: [number, number];
  luckyShotChance?: number;
  coins: number;
  arena: ArenaId;
  /** Pack folder name under public/assets/characters/. */
  spriteKey: string;
  tint?: number;
}

export interface BossPhaseDef {
  id: string;
  name: string;
  /** Enter when hp fraction <= this (1 for the first phase). */
  hpAtMost: number;
  /** Mechanic tag consumed by BossController (e.g. 'rapid_draw', 'dynamite', 'cards', 'fake_signal'). */
  mechanic: string;
  reactionMs: [number, number];
  warningMs: [number, number];
  accuracy: number;
  damage: number;
  /** Extra mechanic parameters (documented per boss in data). */
  params?: Record<string, number | string | boolean>;
}

export interface BossDef extends EnemyDef {
  id: BossId;
  phases: BossPhaseDef[];
  introLines: string[];
  victoryLine: string;
}

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  /** Registry key in PACK_ASSETS.icons. */
  icon: string;
  /** Plain-data modifiers read by the engine (see DuelModifiers). */
  mods: Partial<DuelModifiers>;
  maxStacks?: number;
}

/** Aggregate of all perks and weapon effects applied to one duel. Defaults are neutral (1 / 0). */
export interface DuelModifiers {
  drawSpeedMult: number;
  accuracyBonus: number;
  maxHpBonus: number;
  critChanceBonus: number;
  dodgeWindowMult: number;
  doubleTapChance: number;
  coinMult: number;
  /** Damage-taken multiplier applied while at 1 hp (Last Stand). */
  lastStandDamageMult: number;
  falseStartPenaltyMult: number;
}

export interface DuelConfig {
  gradeThresholdsMs: { excellent: number; great: number; good: number };
  standoffMs: [number, number];
  falseStartPenaltyMs: number;
  falseStartDamage: number;
  dodgeWindowMs: number;
  dodgeCooldownMs: number;
  /** Player base reaction compensation, if any (display lag). */
  inputLagCompMs: number;
}

export interface DuelResult {
  outcome: DuelOutcome;
  /** null when the player never shot or false-started. */
  reactionMs: number | null;
  enemyReactionMs: number;
  grade: Grade | null;
  playerHpLeft: number;
  enemyHpLeft: number;
  damageDealt: number;
  damageTaken: number;
  crit: boolean;
  dodged: boolean;
  falseStart: boolean;
  coins: number;
  seed: number;
}

/** What the engine tells the presentation layer. All times in ms from `performance.now()` origin. */
export interface DuelEvents {
  onPhase: (phase: DuelPhase, at: number) => void;
  /** Enemy tell begins; `fake` true for Coward/El Diablo fake signals (never lethal). */
  onTell: (info: { fake: boolean; durationMs: number; at: number }) => void;
  onDrawSignal: (at: number) => void;
  onFalseStart: (info: { penaltyMs: number; damage: number; at: number }) => void;
  onShot: (info: { by: 'player' | 'enemy'; hit: boolean; damage: number; crit: boolean; at: number }) => void;
  onDodge: (info: { success: boolean; at: number }) => void;
  onHeroState: (state: HeroState, at: number) => void;
  onBossPhase: (info: { phaseId: string; name: string; at: number }) => void;
  onResolve: (result: DuelResult) => void;
}

export interface RunState {
  seed: number;
  round: number;
  totalRounds: number;
  hp: number;
  maxHp: number;
  coins: number;
  weapon: WeaponId;
  upgrades: string[];
  arena: ArenaId;
  defeated: OpponentId[];
}

export interface SaveDataV1 {
  version: 1;
  coins: number;
  unlockedWeapons: WeaponId[];
  equippedWeapon: WeaponId;
  collectedPerks: string[];
  bestReactionMs: number | null;
  settings: { music: number; sfx: number; haptics: boolean; tutorialDone: boolean };
  run: RunState | null;
}
