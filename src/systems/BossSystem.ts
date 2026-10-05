/**
 * Boss encounters (A07). Pure logic, no Phaser.
 *
 *  - `createBossOpponent(bossId, rng, difficulty)` returns an OpponentController for DuelSystem whose
 *    behaviour changes per phase (see docs/BOSSES.md).
 *  - `BossSystem` is the encounter state machine: entrance -> fighting (phases by hp) -> defeated | failed.
 *    Scenes and UI subscribe to `boss.events`.
 *
 * Determinism (D4, F5): the controller only uses the Rng DuelSystem hands it, with a FIXED number of draws per
 * call (waitMs 2, drawMs 1, shotDelayMs 3, aimErrorPx 1) whatever the phase. Phase is state set by BossSystem
 * from hp, which is itself a function of the (deterministic) input log.
 *
 * Fairness: every lethal shot has its own tell >= 450 ms before it (F1). Difficulty only changes information
 * (fake chance), precision (aim error), rhythm (WAIT spread) and sequence (gap, never under 450).
 */
import type { Rng } from '../core/rng';
import { getBossDialogue } from '../data/dialogue';
import {
  BOSS_MIN_FAKE_RECOVER_MS,
  BOSS_MIN_SHOT_GAP_MS,
  bossHpFor,
  getBossDef,
  type BossDef,
  type BossId,
  type BossPhaseDef,
  type BossPhaseNumber,
  type BossReward,
} from '../data/bosses';
import { FAIRNESS_FLOOR_MS } from '../data/enemies';
import { TypedEmitter } from './DuelSystem';
import type { DuelEvents, LoseCause, OpponentController } from './DuelSystem';

const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const EPS = 1e-9;

// ------------------------------------------------------------------ controller

export interface BossFakePlan {
  kind: string;
  /** Ms after the previous shot (the cue for shot 0). */
  startMs: number;
  durationMs: number;
  /** Real tell comes this long after the fake ends. Always >= 400. */
  recoverMs: number;
}

export type BossShotKind = 'opener' | 'follow_up';

/** What the scene needs to telegraph one shot. Times are relative to the previous shot (the cue for shot 0). */
export interface BossShotPlan {
  shotIndex: number;
  phase: BossPhaseNumber;
  kind: BossShotKind;
  /** Position inside the volley, 1-based. */
  volleyPos: number;
  volleyShots: number;
  tellKind: string;
  /** When this shot's real tell starts. 0 for shot 0 (the cue) and for follow-ups (the beat starts at the last shot). */
  tellAtMs: number;
  /** Real tell to lethal shot. Always >= 450 (F1). */
  leadMs: number;
  /** Total delay returned to DuelSystem for this shot. */
  delayMs: number;
  fake: BossFakePlan | null;
  /** Beat labels for one volley (UI). */
  pattern: readonly string[];
}

export interface BossOpponentExtras {
  readonly def: BossDef;
  readonly difficulty: number;
  /** Current behaviour phase (set by BossSystem or tests). */
  readonly phase: BossPhaseNumber;
  /** Tell kind for the next lethal shot (valid after waitMs()). */
  readonly tellKind: string;
  /** Fake tell in the most recently planned shot, else null (compatible with EnemyOpponent.fakeTell). */
  readonly fakeTell: BossFakePlan | null;
  /** Shots in the current volley. */
  readonly shots: number;
  readonly dodgeWindowMs: number;
  /** Scene may shorten the aim budget by this factor (>= 0.7, F7). */
  readonly aimBudgetScale: number;
  /** Plans made so far in this attempt, indexed by shot index. */
  readonly shotPlans: readonly BossShotPlan[];
  /** Switch behaviour phase. Takes effect from the next shot DuelSystem has not planned yet. */
  setPhase(phase: BossPhaseNumber): void;
  /** Environment payoff: the next planned tell comes this much later (adds time only). */
  stagger(ms: number): void;
}

export type BossOpponent = OpponentController & BossOpponentExtras;

export function bossDifficultyProfile(def: BossDef, difficulty: number) {
  const d = clamp01(difficulty);
  const [w0, w1] = def.timing.wait;
  return {
    d,
    waitMin: Math.round(lerp(w0, Math.max(1200, w0 - 200), d)),
    waitMax: Math.round(lerp(w1, w1 + 600, d)),
    /** follow-up gaps shrink a little, never under BOSS_MIN_SHOT_GAP_MS. */
    gapScale: lerp(1, 0.85, d),
    aimScale: lerp(1, 0.72, d),
    fakeChance: (c: readonly [number, number]) => lerp(c[0], c[1], d),
  };
}

class ConfiguredBoss implements BossOpponent {
  readonly id: string;
  readonly def: BossDef;
  readonly difficulty: number;
  fakeTell: BossFakePlan | null = null;
  readonly shotPlans: BossShotPlan[] = [];

  private phaseNo: BossPhaseNumber = 1;
  /** Shots already planned in the current volley (0 = the next planned shot opens a new volley). */
  private volleyPos = 0;
  private beatMs = 0;
  private windUpMs = 0;
  private staggerMs = 0;
  private reactionMs = 0;
  private drawMsValue = 0;
  private readonly prof: ReturnType<typeof bossDifficultyProfile>;

  constructor(def: BossDef, difficulty: number) {
    this.id = def.id;
    this.def = def;
    this.difficulty = clamp01(difficulty);
    this.prof = bossDifficultyProfile(def, this.difficulty);
  }

  get phase(): BossPhaseNumber {
    return this.phaseNo;
  }
  /** Stub bosses (implemented=false) run their phase-1 numbers in every phase until their behaviour is built. */
  private get active(): BossPhaseDef {
    return this.def.implemented ? this.def.phases[this.phaseNo - 1] : this.def.phases[0];
  }
  get tellKind(): string {
    return this.active.tell.kind;
  }
  get shots(): number {
    return this.active.volley.shots;
  }
  get dodgeWindowMs(): number {
    return 250;
  }
  get aimBudgetScale(): number {
    return this.active.aimBudgetScale;
  }

  setPhase(phase: BossPhaseNumber): void {
    if (phase === this.phaseNo) return;
    this.phaseNo = phase;
    // the next planned shot opens a fresh volley of the new phase, after its wind-up (the roar)
    this.volleyPos = 0;
    this.windUpMs = this.def.implemented ? this.def.phases[phase - 1].windUpMs : 0;
  }

  stagger(ms: number): void {
    if (Number.isFinite(ms) && ms > 0) this.staggerMs += ms;
  }

  waitMs(rng: Rng): number {
    // new attempt: state back to phase 1 (hp is reset by the duel); fixed draws: wait, reaction
    this.phaseNo = 1;
    this.volleyPos = 0;
    this.beatMs = 0;
    this.windUpMs = 0;
    this.staggerMs = 0;
    this.fakeTell = null;
    this.shotPlans.length = 0;
    const wait = rng.int(this.prof.waitMin, this.prof.waitMax);
    this.reactionMs = rng.int(this.def.timing.reactionMs[0], this.def.timing.reactionMs[1]);
    return wait;
  }

  drawMs(rng: Rng): number {
    this.drawMsValue = this.reactionMs + rng.int(this.def.timing.drawTimeMs[0], this.def.timing.drawTimeMs[1]);
    return this.drawMsValue;
  }

  shotDelayMs(rng: Rng, shotIndex: number): number {
    // fixed draw count whatever the branch
    const r1 = rng.next();
    const r2 = rng.next();
    rng.next(); // reserved: keeps the stream length stable if a phase later needs a third roll
    const ph = this.active;
    const lead = Math.max(FAIRNESS_FLOOR_MS, ph.tell.leadMs) + Math.floor(r1 * (ph.tell.jitterMs + 1));
    let delay: number;
    let tellAt = 0;
    let fake: BossFakePlan | null = null;
    let kind: BossShotKind = 'opener';

    if (shotIndex === 0) {
      // F1: lead is never shortened by difficulty or phase; jitter only adds time; the gun must be out.
      delay = Math.max(lead, this.drawMsValue);
      this.windUpMs = 0;
      this.staggerMs = 0;
      this.volleyPos = 1;
    } else if (this.volleyPos === 0 || this.volleyPos >= ph.volley.shots) {
      // opener of a new volley: quiet time, optional fake draw, then the real tell, then the lead
      tellAt = ph.volley.reloadMs;
      if (ph.fake && r2 < this.prof.fakeChance(ph.fake.chance)) {
        const recover = Math.max(BOSS_MIN_FAKE_RECOVER_MS, ph.fake.recoverMs);
        fake = { kind: ph.fake.kind, startMs: ph.fake.startMs, durationMs: ph.fake.durationMs, recoverMs: recover };
        tellAt = Math.max(tellAt, ph.fake.startMs + ph.fake.durationMs + recover);
      }
      tellAt += this.windUpMs + this.staggerMs;
      this.windUpMs = 0;
      this.staggerMs = 0;
      delay = tellAt + lead;
      this.volleyPos = 1;
    } else {
      // follow-up inside a volley: its tell is the beat that starts at the previous shot; same tempo all volley
      kind = 'follow_up';
      if (this.volleyPos === 1 || this.beatMs <= 0) {
        const [g0, g1] = ph.volley.gapMs;
        this.beatMs = Math.max(BOSS_MIN_SHOT_GAP_MS, Math.round(lerp(g0, g1, r1) * this.prof.gapScale));
      }
      delay = this.beatMs + this.staggerMs;
      this.staggerMs = 0;
      this.volleyPos++;
    }

    const plan: BossShotPlan = {
      shotIndex,
      phase: this.phaseNo,
      kind,
      volleyPos: this.volleyPos,
      volleyShots: ph.volley.shots,
      tellKind: ph.tell.kind,
      tellAtMs: tellAt,
      leadMs: delay - tellAt,
      delayMs: delay,
      fake,
      pattern: ph.pattern,
    };
    this.shotPlans[shotIndex] = plan;
    this.fakeTell = fake;
    return delay;
  }

  aimErrorPx(rng: Rng, _shotIndex: number): number {
    const r = rng.next();
    const [a0, a1] = this.active.aimErrorPx;
    return a0 + r * Math.max(1, a1 * this.prof.aimScale - a0);
  }
}

/** Build the controller for a boss id. `_rng` is accepted for symmetry with createOpponent; the plan is derived from DuelSystem's rng. */
export function createBossOpponent(bossId: string, _rng: Rng, difficulty = 0): BossOpponent {
  return new ConfiguredBoss(getBossDef(bossId), difficulty);
}

// ------------------------------------------------------------------ encounter state machine

export type BossState = 'idle' | 'entrance' | 'fighting' | 'defeated' | 'failed';

export interface BossEvents {
  onEntrance: {
    t: number; bossId: BossId; name: string; banner: string; subtitle: string; durationMs: number; camera: string;
    previewTell: string | null; arenaId: string; lines: readonly string[];
  };
  onFightStart: { t: number; bossId: BossId };
  onPhaseChange: {
    t: number; bossId: BossId; from: BossPhaseNumber; to: BossPhaseNumber; hp: number; hpFraction: number;
    name: string; signpost: string; windUpMs: number; invulnerableMs: number; lines: readonly string[];
  };
  onInvulnerable: { t: number; bossId: BossId; phase: BossPhaseNumber; untilT: number };
  onVulnerable: { t: number; bossId: BossId; phase: BossPhaseNumber };
  onHpChange: { t: number; bossId: BossId; hp: number; maxHp: number };
  onEnvironment: { t: number; bossId: BossId; targetId: string; propId: string; effect: string; staggerMs: number; phase: BossPhaseNumber };
  onFailure: { t: number; bossId: BossId; phase: BossPhaseNumber; cause: LoseCause | null; hint: string; lines: readonly string[]; retryable: boolean };
  onAttemptRestart: { t: number; bossId: BossId; attempt: number };
  onDefeat: { t: number; bossId: BossId; rewardId: string; reward: BossReward; lines: readonly string[] };
}

export const BOSS_EVENT_NAMES: readonly (keyof BossEvents)[] = [
  'onEntrance', 'onFightStart', 'onPhaseChange', 'onInvulnerable', 'onVulnerable', 'onHpChange', 'onEnvironment',
  'onFailure', 'onAttemptRestart', 'onDefeat',
];

/** The slice of DuelSystem the encounter listens to (DuelSystem satisfies it). */
export interface BossDuelLike {
  readonly events: TypedEmitter<DuelEvents>;
  snapshot(): { enemyHp: number; enemyMaxHp: number };
}

export interface BossSystemOptions {
  bossId: string;
  /** Opponent whose phase is driven by this system (optional: the state machine works without one). */
  opponent?: { setPhase(p: BossPhaseNumber): void; stagger(ms: number): void };
  /** Max hp for phase thresholds; defaults to bossHpFor(def, difficulty). */
  maxHp?: number;
  difficulty?: number;
}

export class BossSystem {
  readonly events = new TypedEmitter<BossEvents>();
  readonly def: BossDef;
  readonly maxHp: number;
  private readonly opponent: BossSystemOptions['opponent'];

  private st: BossState = 'idle';
  private ph: BossPhaseNumber = 1;
  private hpNow: number;
  private invulnerableUntil = -Infinity;
  private invulnerableActive = false;
  private entranceEndsAt = 0;
  private attemptNo = 1;
  private usedEnv = new Set<string>();

  constructor(opts: BossSystemOptions) {
    this.def = getBossDef(opts.bossId);
    const hp = opts.maxHp ?? bossHpFor(this.def, clamp01(opts.difficulty ?? 0));
    this.maxHp = Number.isFinite(hp) && hp > 0 ? hp : this.def.hp;
    this.hpNow = this.maxHp;
    this.opponent = opts.opponent;
  }

  get state(): BossState {
    return this.st;
  }
  get phase(): BossPhaseNumber {
    return this.ph;
  }
  get hp(): number {
    return this.hpNow;
  }
  get attempt(): number {
    return this.attemptNo;
  }
  get isTerminal(): boolean {
    return this.st === 'defeated';
  }
  isInvulnerable(t: number): boolean {
    return this.st === 'fighting' && t < this.invulnerableUntil;
  }

  /** idle -> entrance. Emits onEntrance once. */
  start(t: number): void {
    if (this.st !== 'idle') return;
    this.st = 'entrance';
    this.entranceEndsAt = t + this.def.entrance.durationMs;
    const e = this.def.entrance;
    this.events.emit('onEntrance', {
      t, bossId: this.def.id, name: this.def.name, banner: e.banner, subtitle: e.subtitle, durationMs: e.durationMs,
      camera: e.camera, previewTell: e.previewTell ? this.def.phases[0].tell.kind : null, arenaId: this.def.arenaId,
      lines: getBossDialogue(this.def.dialogueId)?.entrance ?? [],
    });
  }

  /** entrance -> fighting (scene calls this when the entrance ends or is skipped, or on the first cue). */
  beginFight(t: number): void {
    if (this.st === 'idle') this.start(t);
    if (this.st !== 'entrance') return;
    this.st = 'fighting';
    this.events.emit('onFightStart', { t, bossId: this.def.id });
  }

  /** Advance the clock: ends the entrance and invulnerability windows. */
  advanceTo(t: number): void {
    if (!Number.isFinite(t) || this.st === 'defeated') return;
    if (this.st === 'entrance' && t >= this.entranceEndsAt) this.beginFight(t);
    if (this.invulnerableActive && t >= this.invulnerableUntil) {
      this.invulnerableActive = false;
      this.events.emit('onVulnerable', { t, bossId: this.def.id, phase: this.ph });
    }
  }

  /**
   * Report the boss's hp after a hit. Fires phase transitions (once each, in order, several in one call if a
   * big hit skips a threshold) and defeat. A killing blow skips any remaining transitions.
   */
  updateHp(hp: number, t: number): void {
    if (this.st === 'defeated' || this.st === 'failed' || !Number.isFinite(hp)) return;
    if (this.st === 'idle' || this.st === 'entrance') this.beginFight(t);
    const next = Math.min(this.maxHp, Math.max(0, hp));
    if (next === this.hpNow) return;
    this.hpNow = next;
    this.advanceTo(t);
    this.events.emit('onHpChange', { t, bossId: this.def.id, hp: next, maxHp: this.maxHp });
    if (next <= 0) {
      this.defeat(t);
      return;
    }
    const frac = next / this.maxHp;
    while (this.ph < 3 && frac <= this.def.phases[this.ph as 1 | 2]!.enterAtHpFraction + EPS) {
      this.enterPhase((this.ph + 1) as BossPhaseNumber, next, frac, t);
    }
  }

  private enterPhase(to: BossPhaseNumber, hp: number, frac: number, t: number): void {
    const from = this.ph;
    const pd = this.def.phases[to - 1];
    this.ph = to;
    this.opponent?.setPhase(to);
    const lines = getBossDialogue(this.def.dialogueId)?.phaseChange ?? [];
    this.events.emit('onPhaseChange', {
      t, bossId: this.def.id, from, to, hp, hpFraction: frac, name: pd.name, signpost: pd.signpost,
      windUpMs: pd.windUpMs, invulnerableMs: pd.invulnerableMs, lines: lines.length ? [lines[Math.min(lines.length - 1, to - 2)]] : [],
    });
    if (pd.invulnerableMs > 0) {
      this.invulnerableUntil = t + pd.invulnerableMs;
      this.invulnerableActive = true;
      this.events.emit('onInvulnerable', { t, bossId: this.def.id, phase: to, untilT: this.invulnerableUntil });
    }
  }

  /** A prop was shot. If it is a boss target active in this phase (once per phase), apply its payoff. */
  propHit(propId: string, t: number): void {
    if (this.st !== 'fighting') return;
    for (const target of this.def.environment) {
      if (!target.propIds.includes(propId) || !target.phases.includes(this.ph)) continue;
      const key = `${target.id}:${this.ph}`;
      if (this.usedEnv.has(key)) return;
      this.usedEnv.add(key);
      this.opponent?.stagger(target.staggerMs);
      this.events.emit('onEnvironment', {
        t, bossId: this.def.id, targetId: target.id, propId, effect: target.effect, staggerMs: target.staggerMs, phase: this.ph,
      });
      return;
    }
  }

  /** The player lost this attempt. Clean failure: retryable, restarts at phase 1 with the same seed. */
  playerDefeated(cause: LoseCause | null, t: number): void {
    if (this.st !== 'fighting' && this.st !== 'entrance') return;
    this.st = 'failed';
    this.invulnerableActive = false;
    this.invulnerableUntil = -Infinity;
    const f = this.def.failure;
    this.events.emit('onFailure', {
      t, bossId: this.def.id, phase: this.ph, cause, hint: f.hintByPhase[this.ph],
      lines: getBossDialogue(this.def.dialogueId)?.victory ?? [], retryable: f.retryable,
    });
  }

  /** failed -> fighting at phase 1 with full hp. Ignored once defeated (terminal). */
  restartAttempt(t: number): void {
    if (this.st === 'defeated' || this.st === 'idle') return;
    this.attemptNo++;
    this.st = 'fighting';
    this.ph = 1;
    this.hpNow = this.maxHp;
    this.invulnerableActive = false;
    this.invulnerableUntil = -Infinity;
    this.usedEnv.clear();
    this.opponent?.setPhase(1);
    this.events.emit('onAttemptRestart', { t, bossId: this.def.id, attempt: this.attemptNo });
  }

  private defeat(t: number): void {
    if (this.st === 'defeated') return;
    this.st = 'defeated';
    this.invulnerableActive = false;
    this.invulnerableUntil = -Infinity;
    this.events.emit('onDefeat', {
      t, bossId: this.def.id, rewardId: this.def.reward.id, reward: this.def.reward,
      lines: getBossDialogue(this.def.dialogueId)?.defeat ?? [],
    });
  }

  /** Subscribe to a DuelSystem. Returns an unsubscribe function. */
  attachDuel(duel: BossDuelLike): () => void {
    const offs: (() => void)[] = [];
    offs.push(duel.events.on('onWait', (e) => {
      if (e.attempt > 1) this.restartAttempt(e.t);
      else this.start(e.t);
    }));
    offs.push(duel.events.on('onCue', (e) => this.beginFight(e.t)));
    offs.push(duel.events.on('onHit', (e) => {
      if (e.target === 'enemy') this.updateHp(duel.snapshot().enemyHp, e.t);
      else if (e.target === 'prop' && e.propId) this.propHit(e.propId, e.t);
      else this.advanceTo(e.t);
    }));
    offs.push(duel.events.on('onResolve', (e) => {
      if (e.result.outcome === 'WIN') this.updateHp(0, e.t);
      else this.playerDefeated(e.result.cause, e.t);
    }));
    offs.push(duel.events.on('onShot', (e) => this.advanceTo(e.t)));
    return () => offs.forEach((o) => o());
  }
}

/** Everything a scene needs to run a boss duel. */
export function createBossEncounter(bossId: string, rng: Rng, difficulty = 0) {
  const def = getBossDef(bossId);
  const opponent = createBossOpponent(bossId, rng, difficulty);
  const enemyHp = bossHpFor(def, clamp01(difficulty));
  const boss = new BossSystem({ bossId, opponent, maxHp: enemyHp, difficulty });
  return { def, opponent, boss, enemyHp };
}
