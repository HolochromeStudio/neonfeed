/**
 * Enemy AI (A06). `createOpponent(enemyId, rng, difficulty)` returns an OpponentController
 * for DuelSystem. Pure and deterministic: all randomness comes from the Rng DuelSystem
 * passes into each call (D4, F5). Retries re-create the duel from the same seed, so the
 * same plan is re-derived (the controller keeps only values derived from that stream).
 *
 * Difficulty (0..1) scales information (fake-tell chance), precision (aim error),
 * rhythm (WAIT spread) and sequence (shot gap, hp tier). It NEVER shortens the
 * tell-to-lethal time (RULE F1).
 */
import type { Rng } from '../core/rng';
import type { OpponentController } from './DuelSystem';
import {
  FAIRNESS_FLOOR_MS,
  MIN_SHOT_GAP_MS,
  getEnemyDef,
  maxDisarmsFor,
  type DodgeTellKind,
  type EnemyDef,
  type FakeTellDef,
  type Range,
  type TellKind,
} from '../data/enemies';

export interface FakeTellPlan {
  kind: string;
  /** Ms from the start of WAIT. */
  startMs: number;
  durationMs: number;
  /** The real cue lands this long after the fake ends. Always >= 400. */
  recoverMs: number;
}

/** Perk-driven controller options (all optional, default off). See docs/ENEMY_AI.md "Perk hooks". */
export interface OpponentOptions {
  /** devils_deal (`fakeTellEveryDuel`): every duel plans a fake tell, a generic one for enemies without their own. */
  forceFakeTell?: boolean;
  /** bluff (`bluffFeint`): the first player flinch makes the enemy fire a guaranteed miss. */
  bluff?: boolean;
  /** bait (`baitEnabled`): holding still brings the real cue forward and cancels the fake. */
  bait?: boolean;
  /** bait upgrade: also works on the Drunk (no fake tell). */
  baitDrunk?: boolean;
  /** disarmer (`disarmDropsGun`): a limb disarm costs the enemy a pick-up beat. */
  disarmDropsGun?: boolean;
  /** disarmer upgrade: pick-up never faster than 2 beats on bosses. */
  disarmBossFloor?: boolean;
}

/** Maps DuelModifiers fields (src/data/perks.ts) to controller options. */
export function opponentOptionsFromModifiers(
  m: Partial<{ fakeTellEveryDuel: boolean; bluffFeint: boolean; baitEnabled: boolean; disarmDropsGun: boolean }>,
): OpponentOptions {
  return {
    forceFakeTell: !!m.fakeTellEveryDuel,
    bluff: !!m.bluffFeint,
    bait: !!m.baitEnabled,
    disarmDropsGun: !!m.disarmDropsGun,
  };
}

/** One beat of the disarm drop (a pick-up takes 1 beat, bosses at least 2 with the upgrade). */
export const DISARM_BEAT_MS = 300;
/** Bait needs the player to hold still this long (no input) before the enemy cracks. */
export const BAIT_HOLD_MS = 700;
/** Miss distance of a bluffed shot: well past enemyHitTolerancePx (24). */
export const BLUFF_MISS_PX = 64;
/** Generic fake used by devils_deal for enemies with no fake tell of their own. */
export const GENERIC_FAKE: FakeTellDef = { kind: 'generic_feint', chance: [1, 1], durationMs: 300, recoverMs: 450 };

export interface BluffReaction {
  /** Enemy fires this long after the flinch (its own reaction time). */
  fireAfterMs: number;
  /** Aim error of that shot: a guaranteed miss. */
  aimErrorPx: number;
}
export interface BaitReaction {
  /** New WAIT length in ms: the real cue moves here, earlier than the planned cue. */
  cueAtMs: number;
}

/** Optional extensions to OpponentController (see docs/ENEMY_AI.md). DuelSystem may ignore them. */
export interface OpponentExtras {
  readonly def: EnemyDef;
  readonly difficulty: number;
  /** Tell shown at the cue for the current plan (valid after waitMs()). */
  readonly tellKind: TellKind;
  /** Fake tell in the current plan or null (valid after waitMs()). */
  readonly fakeTell: FakeTellPlan | null;
  /** Shots in the current sequence (valid after waitMs()). */
  readonly shots: number;
  /** Bounty hunter variant id announced on the wanted poster, else null. */
  readonly variantId: string | null;
  /** Dodge window of the enemy shot in ms (default 250). */
  readonly dodgeWindowMs: number;
  /** What the player reads to time a dodge. */
  readonly dodgeTellKind: DodgeTellKind;
  /** Limb disarms allowed per attempt for this enemy (D19). Feed `fairness.maxDisarms` per duel. */
  readonly maxDisarms: number;
  /** bluff: reaction to a player flinch (null when disabled or already used). One use per duel; rng-free. */
  reactToFlinch(): BluffReaction | null;
  /** bait: reaction to the player holding still for `heldMs` during WAIT (null when n/a). rng-free. */
  reactToHold(heldMs: number): BaitReaction | null;
  /** disarmer: extra ms added to the re-planned shot after a disarm; 0 when off. rng-free. */
  disarmPickupMs(disarmIndex: number, boss?: boolean): number;
  /** Whether the enemy sidesteps a player shot (coward); consumes rng only when called. */
  evades(rng: Rng, playerShotIndex: number): boolean;
}

export type EnemyOpponent = OpponentController & OpponentExtras;

const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const RELOAD_MS = 1500;
const MIN_FAKE_RECOVER_MS = 400;

/** Difficulty-derived knobs, exported for tests and the balance sim. */
export function difficultyProfile(def: EnemyDef, difficulty: number) {
  const d = clamp01(difficulty);
  const [aMin, aMax] = def.aimErrorPx;
  return {
    d,
    /** precision: max aim error shrinks (enemy gets more accurate). */
    aimMin: aMin,
    aimMax: Math.max(aMin + 1, lerp(aMax, aMax * 0.72, d)),
    /** rhythm: WAIT range widens at both ends (harder to anticipate). */
    waitMin: Math.round(lerp(def.wait[0], Math.max(900, def.wait[0] - 250), d)),
    waitMax: Math.round(lerp(def.wait[1], def.wait[1] + 700, d)),
    /** sequence: follow-up shots come a little quicker, never under the gap floor. */
    gapScale: lerp(1, 0.8, d),
    fakeChance: (f?: FakeTellDef) => (f ? lerp(f.chance[0], f.chance[1], d) : 0),
  };
}

class ConfiguredOpponent implements EnemyOpponent {
  readonly id: string;
  readonly def: EnemyDef;
  readonly difficulty: number;
  tellKind: TellKind;
  fakeTell: FakeTellPlan | null = null;
  shots: number;
  variantId: string | null = null;

  private leadMs: number;
  private jitterMs: number;
  private gap: Range;
  private aim: Range;
  private fake: FakeTellDef | undefined;
  private reactionMs = 0;
  private drawMsValue = 0;
  private readonly prof: ReturnType<typeof difficultyProfile>;
  private extendedWaitMs = 0;
  private bluffUsed = false;
  private readonly opts: OpponentOptions;

  constructor(def: EnemyDef, difficulty: number, opts: OpponentOptions = {}) {
    this.opts = opts;
    this.id = def.id;
    this.def = def;
    this.difficulty = clamp01(difficulty);
    this.prof = difficultyProfile(def, this.difficulty);
    this.tellKind = def.tell.kind;
    this.leadMs = def.tell.leadMs;
    this.jitterMs = def.tell.jitterMs;
    this.shots = def.shots;
    this.gap = def.shotGapMs;
    this.aim = [this.prof.aimMin, this.prof.aimMax];
    this.fake = def.fakeTell;
  }

  get dodgeWindowMs(): number {
    return this.def.dodgeWindowMs ?? 250;
  }

  get dodgeTellKind(): DodgeTellKind {
    return this.def.dodgeTell ?? 'muzzle_raise';
  }

  get maxDisarms(): number {
    return maxDisarmsFor(this.def, this.difficulty);
  }

  reactToFlinch(): BluffReaction | null {
    if (!this.opts.bluff || this.bluffUsed) return null;
    this.bluffUsed = true;
    return { fireAfterMs: this.def.reactionMs[0] + 150, aimErrorPx: BLUFF_MISS_PX };
  }

  reactToHold(heldMs: number): BaitReaction | null {
    if (!this.opts.bait || heldMs < BAIT_HOLD_MS) return null;
    const fake = this.fakeTell;
    if (!fake && !(this.opts.baitDrunk && this.def.id === 'drunk')) return null;
    let cueAtMs = Math.max(900, heldMs + 250);
    // a fake that already played still leaves the 400 ms recovery before the real cue
    if (fake && fake.startMs < heldMs) cueAtMs = Math.max(cueAtMs, fake.startMs + fake.durationMs + 400);
    return cueAtMs < this.extendedWaitMs ? { cueAtMs } : null;
  }

  disarmPickupMs(_disarmIndex: number, boss = false): number {
    if (!this.opts.disarmDropsGun) return 0;
    return (boss && this.opts.disarmBossFloor ? 2 : 1) * DISARM_BEAT_MS;
  }

  waitMs(rng: Rng): number {
    this.bluffUsed = false;
    // fixed draw order: [variant], wait, fake decision, fake start, reaction. Always the same count.
    if (this.def.variants?.length) {
      const v = rng.pick(this.def.variants);
      this.variantId = v.id;
      this.tellKind = v.tellKind;
      this.leadMs = v.leadMs;
      this.jitterMs = v.jitterMs;
      this.shots = v.shots;
      this.gap = v.shotGapMs;
      this.fake = v.fakeTell;
      const base = this.def.aimErrorPx;
      const ae = v.aimErrorPx ?? base;
      this.aim = [ae[0], Math.max(ae[0] + 1, lerp(ae[1], ae[1] * 0.72, this.prof.d))];
    }
    const base = rng.int(this.prof.waitMin, this.prof.waitMax);
    const roll = rng.next();
    const startRoll = rng.next();
    this.reactionMs = rng.int(this.def.reactionMs[0], this.def.reactionMs[1]);
    this.fakeTell = null;
    const f = this.fake ?? (this.opts.forceFakeTell ? GENERIC_FAKE : undefined);
    this.extendedWaitMs = base;
    if (f && (this.opts.forceFakeTell || roll < this.prof.fakeChance(f))) {
      const recover = Math.max(MIN_FAKE_RECOVER_MS, f.recoverMs);
      const startMs = Math.round(300 + startRoll * Math.max(0, base * 0.5 - 300));
      this.fakeTell = { kind: f.kind, startMs, durationMs: f.durationMs, recoverMs: recover };
      this.extendedWaitMs = Math.max(base, startMs + f.durationMs + recover);
      return this.extendedWaitMs;
    }
    return base;
  }

  drawMs(rng: Rng): number {
    this.drawMsValue = this.reactionMs + rng.int(this.def.drawTimeMs[0], this.def.drawTimeMs[1]);
    return this.drawMsValue;
  }

  shotDelayMs(rng: Rng, shotIndex: number): number {
    if (shotIndex === 0) {
      // F1: lead is never shortened by difficulty; jitter only adds time.
      const lead = Math.max(FAIRNESS_FLOOR_MS, this.leadMs) + rng.int(0, this.jitterMs);
      return Math.max(lead, this.drawMsValue);
    }
    const raw = rng.int(this.gap[0], this.gap[1]);
    if (shotIndex >= this.shots) return RELOAD_MS + raw;
    return Math.max(MIN_SHOT_GAP_MS, Math.round(raw * this.prof.gapScale));
  }

  aimErrorPx(rng: Rng, _shotIndex: number): number {
    const r = rng.next();
    const wild = this.def.wildMissChance ?? 0;
    // wild-miss decision always consumes exactly one draw so streams stay aligned
    const w = rng.next();
    if (wild > 0 && w < wild) return 40 + r * 30;
    return this.aim[0] + r * (this.aim[1] - this.aim[0]);
  }

  evades(rng: Rng, _playerShotIndex: number): boolean {
    const c = this.def.evadeChance ?? 0;
    return rng.next() < c * (0.5 + 0.5 * this.difficulty);
  }
}

/** Build the controller for an enemy id. `difficulty` is 0..1 (region depth / elite). */
export function createOpponent(enemyId: string, _rng: Rng, difficulty = 0, options: OpponentOptions = {}): EnemyOpponent {
  return new ConfiguredOpponent(getEnemyDef(enemyId), difficulty, options);
}
