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

  constructor(def: EnemyDef, difficulty: number) {
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

  waitMs(rng: Rng): number {
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
    const f = this.fake;
    if (f && roll < this.prof.fakeChance(f)) {
      const recover = Math.max(MIN_FAKE_RECOVER_MS, f.recoverMs);
      const startMs = Math.round(300 + startRoll * Math.max(0, base * 0.5 - 300));
      this.fakeTell = { kind: f.kind, startMs, durationMs: f.durationMs, recoverMs: recover };
      return Math.max(base, startMs + f.durationMs + recover);
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
export function createOpponent(enemyId: string, _rng: Rng, difficulty = 0): EnemyOpponent {
  return new ConfiguredOpponent(getEnemyDef(enemyId), difficulty);
}
